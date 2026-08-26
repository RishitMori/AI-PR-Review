#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"
: "${REGION:?Set REGION, for example: export REGION=asia-south1}"
: "${INSTANCE_CONNECTION_NAME:?Set INSTANCE_CONNECTION_NAME, for example: export INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE}"

REPO="${REPO:-ai-pr-review-bot}"
API_SERVICE="${API_SERVICE:-ai-pr-review-api}"
WORKER_POOL="${WORKER_POOL:-ai-pr-review-worker}"
MIGRATE_JOB="${MIGRATE_JOB:-ai-pr-review-migrate}"
IMAGE="${IMAGE:-$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest}"
WORKER_INSTANCES="${WORKER_INSTANCES:-1}"

EXISTING_API_URL="$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$EXISTING_API_URL}"
if [[ -z "$PUBLIC_BASE_URL" ]]; then
  PUBLIC_BASE_URL="http://localhost:3000"
fi
GITHUB_CALLBACK_URL="${GITHUB_CALLBACK_URL:-$PUBLIC_BASE_URL/auth/github/callback}"
SESSION_REFRESH_INTERVAL_SECONDS="${SESSION_REFRESH_INTERVAL_SECONDS:-3600}"

COMMON_ENV_VARS="NODE_ENV=production,LOG_LEVEL=${LOG_LEVEL:-silent},PUBLIC_BASE_URL=$PUBLIC_BASE_URL,GITHUB_CALLBACK_URL=$GITHUB_CALLBACK_URL,COOKIE_SECURE=true,SESSION_REFRESH_INTERVAL_SECONDS=$SESSION_REFRESH_INTERVAL_SECONDS,GITHUB_APP_SLUG=${GITHUB_APP_SLUG:-},OPENROUTER_MODEL=openrouter/free,OPENROUTER_FALLBACK_MODELS=,OPENROUTER_MAX_TOKENS=900,MAX_DIFF_CHARS=25000,MAX_REVIEW_COMMENTS=6,LLM_DAILY_LIMIT=40,LLM_MINUTE_LIMIT=5,RAZORPAY_CURRENCY=${RAZORPAY_CURRENCY:-INR}"
COMMON_SECRETS="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_PRIVATE_KEY=GITHUB_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,GITHUB_CLIENT_ID=GITHUB_CLIENT_ID:latest,GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest,JWT_SECRET=JWT_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,RAZORPAY_PAYMENT_LINK_URL=RAZORPAY_PAYMENT_LINK_URL:latest,RAZORPAY_CUSTOMER_PORTAL_URL=RAZORPAY_CUSTOMER_PORTAL_URL:latest"

echo "Using project: $PROJECT_ID"
echo "Using region: $REGION"
echo "Using image: $IMAGE"
echo "Using worker instances: $WORKER_INSTANCES"

gcloud config set project "$PROJECT_ID" >/dev/null

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

echo ""
echo "Redeploy complete."
echo "API URL: $API_URL"
echo "GitHub webhook URL: $API_URL/webhook"
echo ""
echo "Health check:"
echo "curl $API_URL/health"
