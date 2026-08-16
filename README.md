# AI GitHub PR Review Bot

Backend-first MVP for an AI pull request review bot.

It listens to GitHub `pull_request` webhooks, verifies the webhook signature, queues a review job in Redis/BullMQ, fetches the PR diff through a GitHub App installation token, sends the diff to OpenRouter, stores the structured review in PostgreSQL, and posts one summary comment back to the PR.

This version intentionally does not include a dashboard, GitHub OAuth login, or inline comments.

## What Is Included

- Express + TypeScript API
- GitHub webhook signature verification
- GitHub App installation token flow
- PR diff fetch
- OpenRouter multi-model LLM review
- PostgreSQL review storage through Prisma
- Redis + BullMQ async worker
- Duplicate prevention per repo + PR number + head SHA
- Updates the previous bot summary comment on the same PR when a new commit is reviewed
- Stores failed review error details in PostgreSQL
- GitHub OAuth dashboard login with HTTP-only JWT cookie
- React dashboard served from `/dashboard`
- Diff filtering for lockfiles, generated folders, and binary assets
- Summary PR comment posting
- Read-only review inspection APIs

## Requirements

- Node.js 20+
- Docker Desktop
- OpenRouter API key
- GitHub App with access to your test repository
- Public HTTPS webhook URL, usually ngrok for local development

## 1. Install Dependencies

If you have Node/npm installed:

```powershell
npm install
```

If you use pnpm:

```powershell
pnpm install
```

In Codex Desktop, this workspace was verified with the bundled pnpm:

```powershell
& "C:\Users\rishi\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" install
```

## 2. Start PostgreSQL And Redis

```powershell
docker compose up -d postgres redis
```

Check containers:

```powershell
docker compose ps
```

Stop them:

```powershell
docker compose down
```

Delete database/Redis volumes if you want a clean reset:

```powershell
docker compose down -v
```

## 3. Create `.env`

Copy the example:

```powershell
Copy-Item .env.example .env
```

Fill these values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pr_bot
REDIS_URL=redis://localhost:6379

GITHUB_APP_ID=
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_FALLBACK_MODELS=
OPENROUTER_MAX_TOKENS=900
LLM_DAILY_LIMIT=40
LLM_MINUTE_LIMIT=5
JWT_SECRET=at-least-32-random-characters
JWT_EXPIRY_SECONDS=604800
COOKIE_SECURE=false
```

For the private key, keep newline characters as `\n` if you store it on one line.

## 4. Create The Database Tables

Using npm:

```powershell
npm run migrate
```

Using pnpm:

```powershell
pnpm run migrate
```

Codex bundled runtime:

```powershell
& "C:\Users\rishi\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" run migrate
```

This now uses Prisma:

```text
prisma migrate deploy
```

For a brand-new database, `npm run migrate` is enough.

If you already created the database with the older raw SQL migration and Prisma says the database is not empty, baseline it once:

```powershell
npx prisma migrate resolve --applied 20260812000000_init
npm run migrate
```

## 5. Start The App And Worker

Open two terminals.

Terminal 1, API server:

```powershell
npm run dev
```

Terminal 2, worker:

```powershell
npm run worker
```

With pnpm:

```powershell
pnpm run dev
pnpm run worker
```

The server runs on:

```text
http://localhost:3000
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Dashboard:

```text
http://localhost:3000/dashboard
```

GitHub OAuth callback URL for local development:

```text
http://localhost:3000/auth/github/callback
```

## 6. Expose Webhook Locally

Install ngrok, then run:

```powershell
ngrok http 3000
```

Copy the HTTPS forwarding URL, for example:

```text
https://abc123.ngrok-free.app
```

Your GitHub webhook URL will be:

```text
https://abc123.ngrok-free.app/webhook
```

## 7. GitHub App Setup

Create a GitHub App from:

```text
https://github.com/settings/apps/new
```

Use:

- Webhook URL: your ngrok URL + `/webhook`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`
- Repository permissions:
  - Metadata: Read-only
  - Contents: Read-only
  - Pull requests: Read and write
  - Issues: Read and write

Subscribe to events:

- Pull request

After creating the app:

- Copy App ID into `GITHUB_APP_ID`
- Generate a private key and put it in `GITHUB_PRIVATE_KEY`
- Install the app on your test repository

## 8. Test The Full Flow

1. Start Postgres and Redis.
2. Run migrations.
3. Start API server.
4. Start worker.
5. Start ngrok.
6. Set GitHub App webhook URL to `https://your-ngrok-url/webhook`.
7. Open a PR in the repository where the GitHub App is installed.
8. Watch the worker logs.
9. The bot should post a summary review comment on the PR.

## Useful API Endpoints

```text
GET /health
GET /api/reviews
GET /api/reviews/:id
POST /webhook
```

Example:

```powershell
Invoke-RestMethod http://localhost:3000/api/reviews
```

## LLM Model Selection

The backend uses OpenRouter so users can choose many LLMs through one integration.

Free starter model:

```env
OPENROUTER_MODEL=openrouter/free
```

This uses OpenRouter's free-model router. Keep fallbacks empty if you do not want paid models to be used:

```env
OPENROUTER_FALLBACK_MODELS=
```

The app also has local Redis limits to avoid exhausting your free quota too quickly:

```env
LLM_DAILY_LIMIT=40
LLM_MINUTE_LIMIT=5
OPENROUTER_MAX_TOKENS=900
MAX_DIFF_CHARS=25000
MAX_REVIEW_COMMENTS=6
```

OpenRouter free accounts can have low daily/minute limits, so these app limits are intentionally below the public free-tier ceiling. Avoid using `openrouter/auto` if you need predictable cost. It can select paid models.

## Production Build

```powershell
npm run build
npm start
```

Worker:

```powershell
npm run start:worker
```

## Current Limitations

- No dashboard yet
- No GitHub OAuth login yet
- No inline review comments yet
- No per-repository settings UI yet
- One summary comment is posted per reviewed PR head SHA
- Existing bot summary comments are updated on later commits when the previous comment id is known

## Main Files

- `src/server.ts` - Express server
- `dashboard/` - React dashboard
- `src/routes/webhook.ts` - GitHub webhook endpoint
- `src/routes/auth.ts` - GitHub OAuth login/logout/session routes
- `src/workers/review.worker.ts` - BullMQ worker
- `src/services/github.service.ts` - GitHub App/API calls
- `src/services/llm.service.ts` - OpenRouter review call
- `src/services/review.service.ts` - Full review orchestration
- `prisma/schema.prisma` - Prisma data model
- `prisma/migrations/` - PostgreSQL migrations
