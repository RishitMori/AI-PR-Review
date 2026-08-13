# Google Cloud Deployment

This app needs three runtime pieces:

- Cloud Run service: public webhook API
- Cloud Run worker pool: always-on BullMQ worker
- PostgreSQL and Redis

Recommended GCP setup:

- PostgreSQL: Cloud SQL for PostgreSQL
- Redis: Memorystore for Redis if you want everything on GCP, or Upstash Redis if you want the easiest low-friction setup

Memorystore requires VPC networking from Cloud Run. Upstash gives a public TLS Redis URL, which is easier for a first deployment.

## 1. Choose Variables

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
export REPO="ai-pr-review-bot"
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest"
```

## 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com
```

If using Memorystore:

```bash
gcloud services enable redis.googleapis.com vpcaccess.googleapis.com
```

## 3. Create Artifact Registry

```bash
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION
```

## 4. Build And Push Image

```bash
gcloud builds submit --tag $IMAGE
```

## 5. Create PostgreSQL

Create Cloud SQL PostgreSQL from the console or CLI. Note the instance connection name:

```text
PROJECT_ID:REGION:INSTANCE_NAME
```

For Cloud Run + Cloud SQL Unix socket, set:

```env
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

## 6. Create Redis

Easiest option for first deploy: use Upstash and set:

```env
REDIS_URL=rediss://default:PASSWORD@HOST:PORT
```

GCP-only option: create Memorystore Redis, then configure Cloud Run Direct VPC egress or Serverless VPC Access. Set:

```env
REDIS_URL=redis://REDIS_PRIVATE_IP:6379
```

## 7. Deploy API Service

```bash
gcloud run deploy ai-pr-review-api \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --set-env-vars NODE_ENV=production,OPENROUTER_MODEL=openrouter/free,OPENROUTER_FALLBACK_MODELS=,OPENROUTER_MAX_TOKENS=900,MAX_DIFF_CHARS=25000,MAX_REVIEW_COMMENTS=6,LLM_DAILY_LIMIT=40,LLM_MINUTE_LIMIT=5 \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_PRIVATE_KEY=GITHUB_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest
```

Create those secrets first in Secret Manager, or set env vars manually in the Cloud Run console.

## 8. Run Prisma Migration

Use a Cloud Run job with the same image:

```bash
gcloud run jobs create ai-pr-review-migrate \
  --image $IMAGE \
  --region $REGION \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --command pnpm \
  --args run,migrate \
  --set-secrets DATABASE_URL=DATABASE_URL:latest

gcloud run jobs execute ai-pr-review-migrate --region $REGION --wait
```

## 9. Deploy Worker

Cloud Run worker pools are designed for continuous background work.

```bash
gcloud run worker-pools deploy ai-pr-review-worker \
  --image $IMAGE \
  --region $REGION \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --command node \
  --args dist/workers/review.worker.js \
  --set-env-vars NODE_ENV=production,OPENROUTER_MODEL=openrouter/free,OPENROUTER_FALLBACK_MODELS=,OPENROUTER_MAX_TOKENS=900,MAX_DIFF_CHARS=25000,MAX_REVIEW_COMMENTS=6,LLM_DAILY_LIMIT=40,LLM_MINUTE_LIMIT=5 \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_PRIVATE_KEY=GITHUB_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest
```

If worker pools are unavailable in your region or account, use a second Cloud Run service with min instances set to 1 and a tiny worker health server, or deploy the worker to Compute Engine.

## 10. Update GitHub App

After the API deploy finishes, Cloud Run prints a stable URL:

```text
https://ai-pr-review-api-xxxxx.a.run.app
```

Set GitHub App webhook URL to:

```text
https://ai-pr-review-api-xxxxx.a.run.app/webhook
```

Then trigger a PR event and check Cloud Run logs.

## Redeploy After Code Changes

After pushing changes and pulling them in Cloud Shell, you can redeploy everything with:

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
export INSTANCE_CONNECTION_NAME="PROJECT_ID:REGION:INSTANCE_NAME"

bash scripts/gcp-redeploy.sh
```

Optional overrides:

```bash
export REPO="ai-pr-review-bot"
export API_SERVICE="ai-pr-review-api"
export WORKER_POOL="ai-pr-review-worker"
export MIGRATE_JOB="ai-pr-review-migrate"
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest"
```
