# AI GitHub PR Review Bot — Complete Plan & Requirements

## Overview
An automated code review system that listens to GitHub webhook events, analyzes PR diffs using an LLM (OpenAI/Gemini), and posts structured inline review comments back to GitHub. Built with Node.js, PostgreSQL, Redis, and Docker.

---

## What It Does (User Flow)

```
Developer opens PR on GitHub
        ↓
GitHub fires webhook → your server
        ↓
Server fetches PR diff from GitHub API
        ↓
Diff sent to LLM with structured prompt
        ↓
LLM returns review: issues, suggestions, score
        ↓
Bot posts inline comments on the PR
        ↓
Review saved to PostgreSQL (history)
        ↓
Dashboard shows all past reviews
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Your existing expertise |
| Framework | Express.js | Lightweight, fast |
| AI | OpenAI API (GPT-4o) or Gemini API | Structured review output |
| Database | PostgreSQL | Review history, repo config |
| Cache | Redis | Cache diffs, rate limit LLM calls |
| Queue | BullMQ | Async PR processing |
| Auth | GitHub OAuth 2.0 + JWT + Redis Sessions | Secure dashboard login |
| Deploy | Docker + Docker Compose | Single command setup |
| Dashboard | React.js | View review history |
| Hosting | Railway / Render / AWS EC2 | Live public URL |

---

## Authentication Design

### Strategy: GitHub OAuth 2.0 + JWT + Redis Session Store

Only users who authenticate via GitHub can access the dashboard. The webhook endpoint is public but verified via GitHub signature.

### Full Auth Flow

```
[Dashboard User]
       |
       | clicks "Login with GitHub"
       ↓
GET /auth/github
       |
       | redirect to GitHub OAuth
       ↓
GitHub OAuth Consent Screen
       |
       | user approves → GitHub redirects back
       ↓
GET /auth/github/callback?code=xyz
       |
       | exchange code → access_token (GitHub API)
       | fetch user profile from GitHub
       | upsert user in PostgreSQL
       | generate JWT (signed, 7d expiry)
       | store session in Redis (key: session:{userId})
       ↓
Set HTTP-only Cookie: token=<JWT>
       |
       ↓
Redirect to Dashboard /dashboard
       |
       | all API calls send cookie automatically
       ↓
GET /api/reviews  →  authMiddleware verifies JWT
                  →  checks Redis session exists
                  →  attaches user to req.user
                  →  returns data
```

---

### Auth Token Design

```typescript
// JWT Payload
interface JWTPayload {
  userId: number;
  githubId: number;
  username: string;
  avatarUrl: string;
  iat: number;
  exp: number;       // 7 days
}

// Redis Session Key
// key:   session:{userId}
// value: { githubAccessToken, lastActive }
// TTL:   7 days (refreshed on each request)
```

---

### Auth Middleware

```typescript
// src/middleware/auth.middleware.ts
export const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;

    // Check Redis session still active (logout support)
    const session = await redis.get(`session:${payload.userId}`);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    // Refresh Redis TTL (keep-alive)
    await redis.expire(`session:${payload.userId}`, 60 * 60 * 24 * 7);

    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

### Logout Flow

```
POST /auth/logout
  → delete Redis session key
  → clear HTTP-only cookie
  → return 200
```

---

### Webhook Auth (Separate — No JWT)

Webhook endpoint is **NOT** protected by JWT. Instead it uses **GitHub HMAC signature verification**:

```typescript
// src/utils/webhook-verify.ts
export const verifyWebhookSignature = (req, secret: string): boolean => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
};
```

---

### Role-Based Access (Simple)

| Role | Access | How Set |
|---|---|---|
| `owner` | Full access: all repos, all reviews | First GitHub user to login |
| `viewer` | Read-only: can view reviews, cannot delete | Any other GitHub login |

Stored in `users.role` column in PostgreSQL.

---

## Features (MVP — Build These)

### Core (Must Have)
- [ ] GitHub webhook listener (`/webhook` endpoint)
- [ ] Verify GitHub webhook signature (security)
- [ ] Fetch PR diff via GitHub REST API
- [ ] Send diff to LLM with structured prompt
- [ ] Parse LLM response into structured review object
- [ ] Post inline comments back to GitHub PR
- [ ] Post overall PR summary comment
- [ ] Store review in PostgreSQL
- [ ] Redis caching for repeated file patterns
- [ ] BullMQ queue for async processing (don't timeout webhook)
- [ ] Docker + Docker Compose setup

### Authentication (Must Have)
- [ ] GitHub OAuth 2.0 login (`/auth/github` + `/auth/github/callback`)
- [ ] JWT generation on successful OAuth callback
- [ ] HTTP-only cookie set with JWT (XSS-safe)
- [ ] Redis session store with 7-day TTL
- [ ] `authMiddleware` protecting all `/api/*` routes
- [ ] Logout endpoint (clears Redis session + cookie)
- [ ] Users table in PostgreSQL (upsert on login)
- [ ] Role column (`owner` / `viewer`) for access control

### Dashboard (Show to Recruiters)
- [ ] React dashboard (simple, clean UI)
- [ ] List all repositories connected
- [ ] List all PRs reviewed with scores
- [ ] View detailed review for each PR
- [ ] GitHub OAuth login

### Bonus (Add if Time Permits)
- [ ] Re-review on new commits pushed to PR
- [ ] Severity labels (Critical / Warning / Suggestion)
- [ ] PR score (0–100) with breakdown
- [ ] Slack/Discord notification on review complete
- [ ] Support for multiple LLM providers (OpenAI / Gemini toggle)

---

## Project Structure

```
ai-pr-review-bot/
├── src/
│   ├── server.ts                  # Express app entry point
│   ├── routes/
│   │   ├── webhook.ts             # POST /webhook — GitHub events (no auth, sig verified)
│   │   ├── auth.ts                # GET /auth/github, /auth/github/callback, /auth/logout
│   │   └── reviews.ts             # GET /reviews — dashboard API (auth protected)
│   ├── middleware/
│   │   ├── auth.middleware.ts     # JWT verify + Redis session check + req.user attach
│   │   └── role.middleware.ts     # Role-based access (owner vs viewer)
│   ├── services/
│   │   ├── github.service.ts      # GitHub API calls (fetch diff, post comments, OAuth)
│   │   ├── llm.service.ts         # OpenAI/Gemini API calls
│   │   ├── review.service.ts      # Orchestrates the full review flow
│   │   ├── auth.service.ts        # OAuth token exchange, JWT sign/verify, session mgmt
│   │   └── cache.service.ts       # Redis caching + session store logic
│   ├── workers/
│   │   └── review.worker.ts       # BullMQ worker — processes review jobs
│   ├── queue/
│   │   └── review.queue.ts        # BullMQ queue definition
│   ├── db/
│   │   ├── schema.sql             # PostgreSQL schema
│   │   ├── migrations/            # DB migrations
│   │   └── queries.ts             # DB query functions
│   ├── prompts/
│   │   └── review.prompt.ts       # LLM prompt templates
│   ├── types/
│   │   └── index.ts               # TypeScript types/interfaces
│   └── utils/
│       ├── webhook-verify.ts      # GitHub HMAC signature verification
│       └── diff-parser.ts         # Parse raw git diff into structured chunks
├── dashboard/                     # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Repo list + stats
│   │   │   ├── PRList.tsx         # All reviewed PRs
│   │   │   └── ReviewDetail.tsx   # Single PR review detail
│   │   └── components/
│   │       ├── ReviewCard.tsx
│   │       └── CommentBlock.tsx
├── docker-compose.yml             # Postgres + Redis + App
├── Dockerfile
├── .env.example
├── README.md                      # Architecture diagram + setup guide
└── package.json
```

---

## Database Schema (PostgreSQL)

```sql
-- Users authenticated via GitHub OAuth
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  github_id       INTEGER UNIQUE NOT NULL,
  username        VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  avatar_url      VARCHAR(500),
  role            VARCHAR(50) DEFAULT 'viewer',  -- owner | viewer
  created_at      TIMESTAMP DEFAULT NOW(),
  last_login      TIMESTAMP DEFAULT NOW()
);

-- Repositories connected to the bot
CREATE TABLE repositories (
  id          SERIAL PRIMARY KEY,
  github_id   INTEGER UNIQUE NOT NULL,
  owner       VARCHAR(255) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255) NOT NULL,
  installed_at TIMESTAMP DEFAULT NOW()
);

-- Every PR that was reviewed
CREATE TABLE pull_requests (
  id            SERIAL PRIMARY KEY,
  repo_id       INTEGER REFERENCES repositories(id),
  pr_number     INTEGER NOT NULL,
  pr_title      VARCHAR(500),
  pr_author     VARCHAR(255),
  head_sha      VARCHAR(40),
  status        VARCHAR(50) DEFAULT 'pending', -- pending | processing | done | failed
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Individual review generated for a PR
CREATE TABLE reviews (
  id              SERIAL PRIMARY KEY,
  pr_id           INTEGER REFERENCES pull_requests(id),
  overall_score   INTEGER,           -- 0-100
  summary         TEXT,              -- LLM overall summary
  llm_model       VARCHAR(100),      -- gpt-4o / gemini-pro
  tokens_used     INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Individual inline comments per file/line
CREATE TABLE review_comments (
  id            SERIAL PRIMARY KEY,
  review_id     INTEGER REFERENCES reviews(id),
  file_path     VARCHAR(500),
  line_number   INTEGER,
  severity      VARCHAR(50),   -- critical | warning | suggestion | praise
  comment       TEXT,
  github_comment_id BIGINT,    -- ID of posted GitHub comment
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## LLM Prompt Design

```
SYSTEM:
You are an expert senior software engineer performing a code review.
Analyze the following git diff and provide structured, actionable feedback.

Focus on:
1. Bugs and logical errors (severity: critical)
2. Security vulnerabilities (severity: critical)
3. Performance issues (severity: warning)
4. Code style and best practices (severity: suggestion)
5. Positive patterns worth noting (severity: praise)

Return ONLY valid JSON in this format:
{
  "overall_score": <0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "comments": [
    {
      "file": "<file path>",
      "line": <line number>,
      "severity": "critical|warning|suggestion|praise",
      "comment": "<specific, actionable feedback>"
    }
  ]
}

USER:
PR Title: {pr_title}
PR Description: {pr_description}

Diff:
{diff_content}
```

---

## API Endpoints

### Auth Routes (Public)
```
GET  /auth/github              → Redirect to GitHub OAuth consent screen
GET  /auth/github/callback     → Exchange code → JWT → set HTTP-only cookie → redirect /dashboard
POST /auth/logout              → Delete Redis session + clear cookie → redirect /
GET  /auth/me                  → Return current user from JWT (used by React on load)
```

### Webhook (GitHub → Bot — Public, Signature Verified)
```
POST /webhook
  Headers: X-Hub-Signature-256, X-GitHub-Event
  Body: GitHub webhook payload
  Action: Verifies HMAC signature → queues review job → returns 200 immediately
```

### Dashboard API (Protected — Requires Valid JWT Cookie)
```
GET  /api/reviews              → List all reviewed PRs (paginated)      [viewer+]
GET  /api/reviews/:id          → Get single PR review detail             [viewer+]
GET  /api/repos                → List connected repositories             [viewer+]
GET  /api/stats                → Total reviews, avg score, PRs today     [viewer+]
DEL  /api/reviews/:id          → Delete a review                        [owner only]
```

---

## Environment Variables (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# GitHub OAuth App (create at github.com/settings/developers)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

# GitHub App (for posting PR comments + webhook)
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# LLM
OPENAI_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=openai           # openai | gemini

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pr_bot

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=                          # min 32 char random string
JWT_EXPIRY=7d
COOKIE_DOMAIN=localhost              # your domain in production
COOKIE_SECURE=false                  # true in production (HTTPS only)
```

---

## Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: node dist/workers/review.worker.js
    env_file: .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pr_bot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Build Order (Day-by-Day Plan)

### Day 1 — Core Backend + Full Authentication
- [ ] Init TypeScript + Express project with `cookie-parser`, `cors`
- [ ] Set up Docker Compose (Postgres + Redis)
- [ ] Create DB schema including `users` table, run migrations
- [ ] Build GitHub OAuth routes (`/auth/github`, `/auth/github/callback`)
- [ ] Implement `auth.service.ts`: token exchange, JWT sign, Redis session write
- [ ] Implement `auth.middleware.ts`: JWT verify + Redis session check
- [ ] Build `/auth/logout` and `/auth/me` endpoints
- [ ] Build `/webhook` endpoint with HMAC signature verification
- [ ] Set up BullMQ queue + worker skeleton
- [ ] Test full login → JWT cookie → protected route flow

### Day 2 — GitHub + LLM Integration
- [ ] GitHub service: fetch PR diff, list files changed
- [ ] Diff parser: chunk large diffs by file
- [ ] LLM service: send diff, parse structured JSON response
- [ ] Review service: orchestrate full flow
- [ ] Post inline comments back to GitHub PR via API

### Day 3 — Storage + Caching
- [ ] Save reviews and comments to PostgreSQL
- [ ] Redis caching: cache diff by `repo + PR + sha`
- [ ] Redis rate limiter: max 10 LLM calls/min
- [ ] Error handling: failed jobs retry 3x with backoff

### Day 4 — Dashboard
- [ ] React app with GitHub OAuth login
- [ ] PR list page with scores and status
- [ ] Review detail page with inline comments
- [ ] Stats bar: total reviews, avg score, PRs today

### Day 5 — Deploy + Polish
- [ ] Deploy to Railway or Render (free tier)
- [ ] Set up ngrok locally for webhook testing first
- [ ] Connect bot to a real public GitHub repo
- [ ] Screenshot live reviews for resume/portfolio
- [ ] Write professional README with architecture diagram

---

## Resume Bullet (Once Built)

```
• Built an AI-powered GitHub PR Review Bot — processing webhook events, 
  fetching diffs via GitHub API, and using LLM prompt engineering to post 
  structured inline review comments with severity labels; backed by 
  PostgreSQL review history, Redis caching, and BullMQ async processing.
```

---

## What to Show Recruiters

1. **Live URL** → Dashboard with real PR reviews visible
2. **GitHub Repo** → Clean README with architecture diagram
3. **Real PR reviews** → Point bot at a public open-source repo and show actual comments it posted
4. **Architecture diagram** → Draw a simple flow chart (webhook → queue → LLM → GitHub)

---

## Estimated Total Build Time
| Experience Level | Time |
|---|---|
| With your skills (you have all prereqs) | **3–5 days** |
| Including dashboard + deploy | **5–7 days** |

