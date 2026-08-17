#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Re-enabling Cloud Logging _Default sink for project '$PROJECT_ID'..."
gcloud logging sinks update _Default --no-disabled

echo "Done. Future logs will be stored in the _Default log bucket again."
