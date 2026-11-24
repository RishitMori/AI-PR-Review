# Event-driven production deployment

GitHub webhook -> Postgres job record -> Cloud Tasks -> Cloud Run review endpoint.
Firebase serves dashboard files directly. There is no periodic queue polling.
Cloud Run uses request-based billing with zero minimum instances. Builds, storage,
network, database storage and model usage can still incur charges.

## Database cutover to Neon

1. Create a Neon Postgres project near asia-south1 and enable scale-to-zero.
2. Back up the existing database before changing any connection secrets. Use
   `pg_dump --format=custom --no-owner --no-acl` with the existing connection
   details in your local PostgreSQL environment (do not commit credentials).
3. Restore into an empty Neon database using `pg_restore --no-owner --no-acl`.
   Include `_prisma_migrations` so applied migration history is preserved.
   Check row counts for users, repositories, reviews and review_jobs.
4. Pause writes during the final backup/cutover so recent records are not lost.
   Retain the original database and backup until login and a real PR review pass.
5. Add a new Secret Manager version of DATABASE_URL with the Neon SSL connection
   string. Use a direct Neon connection for dump/restore; its pooled connection
   can serve the API. Never paste credentials into chat or command history.
6. Unset INSTANCE_CONNECTION_NAME when deploying against Neon. The deployment
   clears old Cloud SQL attachments from the API and migration job.

The script cannot create your Neon account or migrate data without access.
Cloud SQL continues to cost money until separately stopped/decommissioned after
the verified cutover; this script deliberately does not delete your database.

## Deploy from Cloud Shell

```bash
export PROJECT_ID=ai-reviewer-505305
export REGION=asia-south1
export PUBLIC_BASE_URL=https://ai-reviewer-505305.web.app
export GITHUB_CALLBACK_URL=$PUBLIC_BASE_URL/auth/github/callback
export GITHUB_APP_SLUG=reviewpilot-ai-app
export USE_REDIS=false
unset INSTANCE_CONNECTION_NAME # only after DATABASE_URL points to Neon
bash scripts/gcp-redeploy.sh
pnpm install --frozen-lockfile
pnpm run build
firebase deploy --only hosting --project "$PROJECT_ID"
```

To keep Cloud SQL during the transition, set INSTANCE_CONNECTION_NAME to the
existing instance instead of unsetting it. The deployer needs permission to
create the queue, service account and secret IAM bindings. The runtime identity
gets Cloud Tasks enqueue permission and access to the configured secrets.
Tasks use the existing shared processor secret, not a public task-name header,
to authenticate delivery. Do not run deployment with `bash -x` because deployment
commands involving secrets could expose their values.

The script runs database migrations before deploying the API, provisions a
serial task queue, then configures its target URL. After success, it pauses the
old Scheduler job and sets the old worker pool to zero. Existing Postgres jobs
are retained; redeliver pending PR webhooks from GitHub to dispatch their tasks.
Already-completed jobs remain deduplicated. Do not restart the legacy worker.

## Verification

* `/health` reports database OK and Redis disabled.
* Login succeeds and dashboard assets are served by Firebase.
* POST `/internal/process-reviews` without the secret returns 401.
* Open/update a PR: the webhook responds 202, a task appears in `review-pr`, and
  the job completes with a PR comment. Redelivery must not add another review
  for an already-completed commit.
* A failed processing request returns 503 so Cloud Tasks retries. Jobs have
  three processing attempts; exhausted jobs remain marked dead for inspection.
  A crashed processing lease can be reclaimed after 15 minutes.
* Verify old worker instance count is zero and Scheduler state is PAUSED.

For local development leave CLOUD_TASKS_PROJECT empty, run migrations and the
API, then POST `/internal/process-reviews?limit=1` with x-internal-secret matching
PROCESS_REVIEWS_SECRET. This uses the durable Postgres queue without Google
credentials. Tests: `node --import tsx --test tests/tasks.test.ts`.

Task delivery is at least once. Job leases prevent concurrent processing, and
completed commits are skipped. A crash between a GitHub comment write and its
database acknowledgement can still repeat an external side effect; inspect
failed jobs before manual replay.
