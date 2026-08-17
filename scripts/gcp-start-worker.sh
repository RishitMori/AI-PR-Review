#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"
: "${REGION:?Set REGION, for example: export REGION=asia-south1}"

WORKER_POOL="${WORKER_POOL:-ai-pr-review-worker}"
WORKER_INSTANCES="${WORKER_INSTANCES:-1}"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Starting GCP worker pool '$WORKER_POOL' with $WORKER_INSTANCES instance(s)..."
gcloud run worker-pools update "$WORKER_POOL" \
  --region "$REGION" \
  --instances "$WORKER_INSTANCES"

echo "Done. Worker pool is running."
