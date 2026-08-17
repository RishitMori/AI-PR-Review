#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"
: "${REGION:?Set REGION, for example: export REGION=asia-south1}"

WORKER_POOL="${WORKER_POOL:-ai-pr-review-worker}"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Stopping GCP worker pool '$WORKER_POOL' to pause review processing and worker billing..."
gcloud run worker-pools update "$WORKER_POOL" \
  --region "$REGION" \
  --instances 0

echo "Done. Worker pool is set to 0 instances."
