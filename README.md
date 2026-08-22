# ReviewPilot - AI GitHub PR Review Bot

ReviewPilot is an AI pull request review bot with a GitHub App webhook, async worker, PostgreSQL review history, GitHub OAuth dashboard login, and a React dashboard.

It listens to GitHub `pull_request` events, verifies the webhook signature, queues review work in Redis/BullMQ, fetches the PR diff with a GitHub App installation token, sends the diff to OpenRouter, stores the structured review in PostgreSQL, and posts a summary review comment back to the PR.

## What Is Included

- Express + TypeScript API
- GitHub App webhook signature verification
- GitHub App installation token flow
- GitHub OAuth dashboard login with HTTP-only JWT cookies
- Redis-backed sessions with logout support
- GitHub OAuth grant revocation on logout
- PostgreSQL storage through Prisma
- Redis + BullMQ async review worker
- OpenRouter LLM review with local rate limits
- Duplicate prevention per repo, PR number, and head SHA
- Summary PR comment posting and updating
- React dashboard served from `/dashboard`
- Dashboard routes for overview, inbox, repositories, setup, billing, and security
- Per-repository review settings UI
- Review history, comments, failure states, and stats
- Optional Razorpay hosted billing links

## Requirements

- Node.js 20+
- Docker Desktop
- PostgreSQL
- Redis
- OpenRouter API key
- GitHub App with access to your test repository
- GitHub OAuth credentials for dashboard login
- Public HTTPS webhook URL, usually ngrok for local development

## 1. Install Dependencies

```powershell
pnpm install
```

Or with npm:

```powershell
npm install
```

## 2. Start PostgreSQL And Redis

```powershell
docker compose up -d postgres redis
```

Check containers:

```powershell
docker compose ps
```

Stop containers:

```powershell
docker compose down
```

Reset database and Redis volumes:

```powershell
docker compose down -v
```

## 3. Create `.env`

Copy the example:

```powershell
Copy-Item .env.example .env
```

Fill the important values:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
PUBLIC_BASE_URL=http://localhost:3000

DATABASE_URL=postgresql://user:password@localhost:5432/pr_bot
REDIS_URL=redis://localhost:6379

GITHUB_APP_ID=
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
GITHUB_APP_SLUG=

LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_FALLBACK_MODELS=
OPENROUTER_MAX_TOKENS=900
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=AI PR Review Bot

MAX_DIFF_CHARS=25000
MAX_REVIEW_COMMENTS=6
LLM_DAILY_LIMIT=40
LLM_MINUTE_LIMIT=5

JWT_SECRET=at-least-32-random-characters
JWT_EXPIRY_SECONDS=604800
SESSION_REFRESH_INTERVAL_SECONDS=3600
COOKIE_SECURE=false

RAZORPAY_PAYMENT_LINK_URL=
RAZORPAY_CUSTOMER_PORTAL_URL=
```

For `GITHUB_PRIVATE_KEY`, keep newline characters as `\n` if you store the key on one line.

## 4. Run Database Migrations

```powershell
pnpm run migrate
```

Or:

```powershell
npm run migrate
```

This runs:

```text
prisma migrate deploy
```

If you already created the database with an older raw SQL migration and Prisma says the database is not empty, baseline it once:

```powershell
npx prisma migrate resolve --applied 20260812000000_init
npm run migrate
```

## 5. Start The App And Worker

Open two terminals.

API server:

```powershell
pnpm run dev
```

Worker:

```powershell
pnpm run worker
```

The server runs at:

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

## 6. GitHub App Setup

Create a GitHub App:

```text
https://github.com/settings/apps/new
```

Use:

- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/github/callback`
- Webhook URL: your public HTTPS URL + `/webhook`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`

Repository permissions:

- Metadata: Read-only
- Contents: Read-only
- Pull requests: Read and write
- Issues: Read and write

Subscribe to events:

- Pull request
- Installation
- Installation repositories

After creating the app:

- Copy App ID into `GITHUB_APP_ID`
- Copy app slug into `GITHUB_APP_SLUG`
- Generate a private key and put it in `GITHUB_PRIVATE_KEY`
- Copy OAuth client ID into `GITHUB_CLIENT_ID`
- Generate/copy OAuth client secret into `GITHUB_CLIENT_SECRET`
- Install the app on your test repository

## 7. Expose Webhook Locally

Install ngrok, then run:

```powershell
ngrok http 3000
```

Copy the HTTPS forwarding URL:

```text
https://abc123.ngrok-free.app
```

Use this webhook URL in the GitHub App:

```text
https://abc123.ngrok-free.app/webhook
```

For local OAuth testing, keep the callback URL as:

```text
http://localhost:3000/auth/github/callback
```

For production, update it to:

```text
https://YOUR_PRODUCTION_URL/auth/github/callback
```

## 8. Test The Full Flow

1. Start PostgreSQL and Redis.
2. Run migrations.
3. Start the API server.
4. Start the worker.
5. Start ngrok or deploy to a public HTTPS URL.
6. Set the GitHub App webhook URL to `https://your-url/webhook`.
7. Visit `/dashboard`.
8. Log in with GitHub.
9. Install the GitHub App from `/dashboard/setup`.
10. Open a PR in an installed repository.
11. Watch the worker logs.
12. Confirm the PR receives a ReviewPilot summary comment.
13. Confirm the dashboard shows the review in `/dashboard/inbox`.

## Dashboard Routes

```text
/                         Public landing page
/dashboard                Dashboard overview
/dashboard/inbox          Reviewed PR inbox
/dashboard/repos          Repository list and settings
/dashboard/setup          GitHub App setup checklist
/dashboard/billing        Billing and payment-method entry point
/dashboard/security       Security and SSO account controls
/switch-github            Connected GitHub account handoff
/terms                    Terms page
/privacy                  Privacy page
/contact                  Contact page
```

Route aliases:

```text
/dashboard/reviews        -> PR inbox
/dashboard/prs            -> PR inbox
/dashboard/repositories   -> repositories
/dashboard/payment        -> billing
/dashboard/payments       -> billing
/dashboard/plans          -> billing
/dashboard/sso            -> security
/dashboard/auth           -> security
```

## Useful API Endpoints

```text
GET   /health
GET   /auth/me
GET   /api/stats
GET   /api/reviews
GET   /api/reviews/:id
GET   /api/repos
GET   /api/setup
GET   /api/billing
PATCH /api/repos/:id/settings
POST  /auth/logout
POST  /webhook
```

Dashboard API routes require a valid dashboard session cookie.

## Billing With Razorpay

Billing is optional. The app is ready to open hosted Razorpay links, but it does not store card details or process payments directly.

For a one-time or manually managed plan, create a Razorpay Payment Link and add it to `.env`:

```env
RAZORPAY_PAYMENT_LINK_URL=https://rzp.io/...
RAZORPAY_CUSTOMER_PORTAL_URL=
```

For recurring billing, create a Razorpay Subscription Plan and Subscription Link, then use that subscription link as `RAZORPAY_PAYMENT_LINK_URL`.

Restart the server after changing `.env`. The Billing page enables payment buttons when these values are present.

## GitHub Login And Logout

Dashboard login uses GitHub OAuth, an HTTP-only JWT cookie, and a Redis session.

On logout, the app:

- Revokes the ReviewPilot GitHub OAuth authorization when a valid GitHub token is available
- Deletes the Redis session
- Clears local auth cookies
- Clears pending OAuth state cookies

Stored dashboard data remains in PostgreSQL. If the same GitHub account signs in again, its stored repositories and reviews can appear again.

## LLM Model Selection

The backend uses OpenRouter so you can choose models through one integration.

Free starter model:

```env
OPENROUTER_MODEL=openrouter/free
```

Keep fallbacks empty if you do not want paid models to be used:

```env
OPENROUTER_FALLBACK_MODELS=
```

The app also has local Redis limits:

```env
LLM_DAILY_LIMIT=40
LLM_MINUTE_LIMIT=5
OPENROUTER_MAX_TOKENS=900
MAX_DIFF_CHARS=25000
MAX_REVIEW_COMMENTS=6
```

Avoid `openrouter/auto` if you need predictable cost because it can choose paid models.

## Production Build

```powershell
pnpm run build
pnpm start
```

Worker:

```powershell
pnpm run start:worker
```

For production, set:

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://YOUR_PRODUCTION_URL
GITHUB_CALLBACK_URL=https://YOUR_PRODUCTION_URL/auth/github/callback
COOKIE_SECURE=true
```

Also update the GitHub App webhook URL:

```text
https://YOUR_PRODUCTION_URL/webhook
```

## Deployment

See [docs/gcp-deployment.md](docs/gcp-deployment.md) for a Google Cloud Run deployment path using:

- Cloud Run API service
- Cloud Run worker pool
- Cloud SQL PostgreSQL
- Redis through Upstash or GCP Memorystore
- Secret Manager
- Prisma migration job

## Current Limitations

- The bot posts one summary PR comment, not GitHub inline review comments.
- Razorpay payment state is not synced back into the database yet.
- Paid plan enforcement is not implemented yet.
- Slack/Discord notifications are not implemented yet.
- The dashboard is currently a single React entry file rather than split into route components.

## Main Files

- `src/server.ts` - Express server and dashboard fallback routing
- `src/routes/webhook.ts` - GitHub webhook endpoint
- `src/routes/auth.ts` - GitHub OAuth login/logout/session routes
- `src/routes/reviews.ts` - Protected dashboard API routes
- `src/workers/review.worker.ts` - BullMQ worker
- `src/services/github.service.ts` - GitHub App/API calls
- `src/services/llm.service.ts` - OpenRouter review call
- `src/services/review.service.ts` - Full review orchestration
- `src/services/auth.service.ts` - OAuth, JWT, Redis sessions, GitHub grant revoke
- `src/db/queries.ts` - Prisma-backed query helpers
- `dashboard/src/App.tsx` - React dashboard and public pages
- `dashboard/src/styles.css` - Dashboard and landing page styling
- `prisma/schema.prisma` - Prisma data model
- `prisma/migrations/` - PostgreSQL migrations
- `docs/gcp-deployment.md` - Production deployment guide

## Recruiter Demo Checklist

1. Public URL opens the landing page.
2. Dashboard login works with GitHub OAuth.
3. GitHub App can be installed from `/dashboard/setup`.
4. A real PR triggers a webhook and worker review.
5. The PR gets a ReviewPilot summary comment.
6. `/dashboard/inbox` shows the review and saved comments.
7. `/dashboard/repos` shows per-repository settings.
8. README and deployment docs match the live app.
