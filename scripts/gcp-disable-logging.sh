#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, for example: export PROJECT_ID=ai-reviewer-505305}"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Disabling Cloud Logging _Default sink for project '$PROJECT_ID'..."
gcloud logging sinks update _Default --disabled

echo "Done. Future non-required logs will not be stored in the _Default log bucket."
echo "Required audit logs can still exist because Google keeps them separately."
