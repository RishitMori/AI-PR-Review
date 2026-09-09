#!/usr/bin/env bash
set -euo pipefail

pause_on_error() {
  local exit_code=$?
  local line_number="${1:-unknown}"

  if [[ "$exit_code" -eq 0 ]]; then
    return
  fi

  echo ""
  echo "Redeploy failed at line $line_number with exit code $exit_code."
  echo "Check the error message above."

  if [[ -t 0 && "${NO_PAUSE_ON_ERROR:-}" != "1" ]]; then
    echo ""
    read -r -p "Press Enter to close this terminal..." _
  fi

  exit "$exit_code"
}

trap 'pause_on_error $LINENO' ERR

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"
: "${REGION:?Set REGION, for example: export REGION=asia-south1}"
: "${INSTANCE_CONNECTION_NAME:?Set INSTANCE_CONNECTION_NAME, for example: export INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE}"

REPO="${REPO:-ai-pr-review-bot}"
API_SERVICE="${API_SERVICE:-ai-pr-review-api}"
WORKER_POOL="${WORKER_POOL:-ai-pr-review-worker}"
MIGRATE_JOB="${MIGRATE_JOB:-ai-pr-review-migrate}"
CLOUD_SCHEDULER_JOB="${CLOUD_SCHEDULER_JOB:-ai-pr-review-process-reviews}"
IMAGE="${IMAGE:-$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest}"
WORKER_INSTANCES="${WORKER_INSTANCES:-0}"

EXISTING_API_URL="$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$EXISTING_API_URL}"
if [[ -z "$PUBLIC_BASE_URL" ]]; then
  PUBLIC_BASE_URL="http://localhost:3000"
fi
GITHUB_CALLBACK_URL="${GITHUB_CALLBACK_URL:-$PUBLIC_BASE_URL/auth/github/callback}"
SESSION_REFRESH_INTERVAL_SECONDS="${SESSION_REFRESH_INTERVAL_SECONDS:-3600}"

COMMON_ENV_VARS="NODE_ENV=production,LOG_LEVEL=${LOG_LEVEL:-error},PUBLIC_BASE_URL=$PUBLIC_BASE_URL,GITHUB_CALLBACK_URL=$GITHUB_CALLBACK_URL,COOKIE_SECURE=true,USE_REDIS=${USE_REDIS:-false},SESSION_REFRESH_INTERVAL_SECONDS=$SESSION_REFRESH_INTERVAL_SECONDS,GITHUB_APP_SLUG=${GITHUB_APP_SLUG:-},OPENROUTER_MODEL=openrouter/free,OPENROUTER_FALLBACK_MODELS=,OPENROUTER_MAX_TOKENS=900,MAX_DIFF_CHARS=25000,MAX_REVIEW_COMMENTS=6,LLM_DAILY_LIMIT=40,LLM_MINUTE_LIMIT=5,RAZORPAY_CURRENCY=${RAZORPAY_CURRENCY:-INR}"
COMMON_SECRETS="DATABASE_URL=DATABASE_URL:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_PRIVATE_KEY=GITHUB_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,GITHUB_CLIENT_ID=GITHUB_CLIENT_ID:latest,GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest,JWT_SECRET=JWT_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,PROCESS_REVIEWS_SECRET=PROCESS_REVIEWS_SECRET:latest"

ensure_process_reviews_secret() {
  if gcloud secrets describe PROCESS_REVIEWS_SECRET >/dev/null 2>&1; then
    return
  fi

  echo "Creating PROCESS_REVIEWS_SECRET..."
  printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create PROCESS_REVIEWS_SECRET --data-file=-
}

append_optional_secret() {
  local secret_name="$1"

  if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
    COMMON_SECRETS="$COMMON_SECRETS,$secret_name=$secret_name:latest"
  else
    echo "Skipping optional secret: $secret_name was not found"
  fi
}

echo "Using project: $PROJECT_ID"
echo "Using region: $REGION"
echo "Using image: $IMAGE"
echo "Using worker instances: $WORKER_INSTANCES"
echo "Using public base URL: $PUBLIC_BASE_URL"
echo "Using GitHub callback URL: $GITHUB_CALLBACK_URL"
echo "Using Redis: ${USE_REDIS:-false}"

gcloud config set project "$PROJECT_ID" >/dev/null

ensure_process_reviews_secret

append_optional_secret REDIS_URL
append_optional_secret RAZORPAY_KEY_ID
append_optional_secret RAZORPAY_KEY_SECRET
append_optional_secret RAZORPAY_WEBHOOK_SECRET
append_optional_secret RAZORPAY_PAYMENT_LINK_URL
append_optional_secret RAZORPAY_CUSTOMER_PORTAL_URL

echo "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION"

echo "Building and pushing image..."
gcloud builds submit --tag "$IMAGE"

echo "Deploying API service..."
gcloud run deploy "$API_SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "$COMMON_ENV_VARS" \
  --set-secrets "$COMMON_SECRETS" \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi \
  --cpu 1

echo "Creating or updating Prisma migration job..."
if gcloud run jobs describe "$MIGRATE_JOB" --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$MIGRATE_JOB" \
    --image "$IMAGE" \
    --region "$REGION" \
    --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
    --command pnpm \
    --args run,migrate \
    --set-secrets DATABASE_URL=DATABASE_URL:latest
else
  gcloud run jobs create "$MIGRATE_JOB" \
    --image "$IMAGE" \
    --region "$REGION" \
    --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
    --command pnpm \
    --args run,migrate \
    --set-secrets DATABASE_URL=DATABASE_URL:latest
fi

echo "Running Prisma migration job..."
gcloud run jobs execute "$MIGRATE_JOB" --region "$REGION" --wait

echo "Deploying worker pool..."
gcloud run worker-pools deploy "$WORKER_POOL" \
  --image "$IMAGE" \
  --region "$REGION" \
  --instances "$WORKER_INSTANCES" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --command node \
  --args dist/workers/review.worker.js \
  --set-env-vars "$COMMON_ENV_VARS" \
  --set-secrets "$COMMON_SECRETS"

API_URL="$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)')"

if [[ "${SCHEDULER_ENABLED:-true}" == "true" ]]; then
  echo "Configuring Cloud Scheduler review processor..."
  gcloud services enable cloudscheduler.googleapis.com >/dev/null

  PROCESS_REVIEWS_SECRET_VALUE="$(gcloud secrets versions access latest --secret=PROCESS_REVIEWS_SECRET)"
  PROCESSOR_URL="$API_URL/internal/process-reviews?limit=${PROCESS_REVIEW_LIMIT:-1}"

  if gcloud scheduler jobs describe "$CLOUD_SCHEDULER_JOB" --location "$REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$CLOUD_SCHEDULER_JOB" \
      --location "$REGION" \
      --schedule "* * * * *" \
      --time-zone "Etc/UTC" \
      --uri "$PROCESSOR_URL" \
      --http-method POST \
      --headers "x-internal-secret=$PROCESS_REVIEWS_SECRET_VALUE"
  else
    gcloud scheduler jobs create http "$CLOUD_SCHEDULER_JOB" \
      --location "$REGION" \
      --schedule "* * * * *" \
      --time-zone "Etc/UTC" \
      --uri "$PROCESSOR_URL" \
      --http-method POST \
      --headers "x-internal-secret=$PROCESS_REVIEWS_SECRET_VALUE"
  fi
else
  echo "Skipping Cloud Scheduler because SCHEDULER_ENABLED is not true."
fi

echo ""
echo "Redeploy complete."
echo "API URL: $API_URL"
echo "GitHub webhook URL: $API_URL/webhook"
echo "GitHub OAuth callback URL: $GITHUB_CALLBACK_URL"
echo "Review processor URL: $API_URL/internal/process-reviews?limit=${PROCESS_REVIEW_LIMIT:-1}"
echo ""
echo "Health check:"
echo "curl $API_URL/health"
