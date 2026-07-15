# CLAUDE.md

Context for Claude Code sessions working on this repo. Read this first — it is
auto-loaded at session start so a new chat has full context without re-deriving it.

## What this is

A full-stack **GitHub Repository Dashboard**: monitor repos, track outdated
dependencies, detect vulnerabilities (Dependabot), visualize architecture, and
aggregate logs. Target production domain: **dashboard.postiusgroup.com**.

## Tech stack

- **Frontend**: React 18 + Vite + Wouter (routing) + TanStack Query + Tailwind
- **Backend**: Express + Passport (local auth, session-based) + node-cron jobs
- **DB**: PostgreSQL via Drizzle ORM; sessions in a `session` table (connect-pg-simple)
- **Language**: TypeScript throughout, ESM (`"type": "module"`)
- **Build**: `vite build` (client → `dist/public`) + `esbuild` (server → `dist/index.js`)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (tsx), port 5000, Vite middleware |
| `npm run build` | Production build → `dist/` |
| `npm start` | Run built server (`node dist/index.js`) |
| `npm run check` | Type-check (`tsc`, no emit) |
| `npm test` | Vitest suite (needs a reachable Postgres — see below) |
| `npm run db:push` | Push Drizzle schema to `DATABASE_URL` |

## Architecture map

```
client/src/          React app (pages/, components/, hooks/, lib/)
server/
  index.ts           Entry: creates pool, calls createApp(), listens, starts jobs
  app.ts             createApp(pool) factory — builds the Express app (testable)
  auth.ts            Passport local strategy, hashPassword/verifyPassword, sanitizeUser
  routes.ts          /api/* routes (mounted under /api)
  db.ts              Drizzle db + its own pg Pool (throws if DATABASE_URL unset)
  services/          github, dependency, vulnerability, architecture, sync
  jobs/              cron: sync + vulnerability detection
  __tests__/         Vitest: auth.unit.test.ts, api.test.ts (supertest)
shared/schema.ts     Drizzle tables + Zod schemas (single source of truth)
scripts/             Deployment automation (see DEPLOY.md)
```

## Environment variables

Required: `DATABASE_URL`, `SESSION_SECRET` (32+ chars), `GITHUB_TOKEN` (`ghp_…`,
scopes: repo + read:user), `NODE_ENV`. Optional: `PORT` (default 5000; prod uses
8000), `SYNC_INTERVAL_MINUTES` (60), `LOG_LEVEL` (info).

Copy `.env.production.template` → `.env.production` (gitignored) and fill it in.
Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Running tests locally

Tests import `server/db.ts`, which throws without `DATABASE_URL`, and exercise
real endpoints, so they need a Postgres. Set `NODE_ENV=test` (so `createApp`
skips the Vite/static branches and issues non-secure cookies), point
`DATABASE_URL` at a test DB, run `npm run db:push` once, then `npm test`.
CI does exactly this against a `postgres:16` service.

## Deployment

See **DEPLOY.md** for the runbook. In short: Railway (Docker) + Cloudflare DNS +
PostgreSQL (Neon). One-command guided path: `bash scripts/orchestrate-deployment.sh`.
Detailed references: `POSTIUSGROUP_SETUP.md`, `DEPLOYMENT_AUTOMATION.md`,
`scripts/cloudflare-setup.md`. Deploying for real needs the user's Railway
account, a Postgres URL, and a GitHub token — cannot be completed without them.

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`: install →
type-check → build → `db:push` → `npm test`, against a Postgres service. Keep it
green. `package-lock.json` is gitignored, so CI uses `npm install`, not `npm ci`.

## Conventions & gotchas (things that will bite a fresh session)

- **ESM project.** Standalone Node scripts must be `.cjs` (e.g. `scripts/*.cjs`);
  a `.js` file using `require()` crashes.
- **`package-lock.json` is gitignored** → always `npm install`, never `npm ci`.
- **Server bundle is `dist/index.js`** (not `dist/server/index.js`) — Dockerfile,
  `railway.json`, and `npm start` all depend on this path.
- **`trust proxy` is set in production** so secure session cookies work behind
  Railway/Cloudflare TLS termination. Without it, login silently fails in prod.
- **`app.ts` owns the app, `index.ts` owns the listener + jobs.** Add routes/
  middleware in `createApp`; don't reintroduce a top-level listener elsewhere.
- **Never leak the password hash.** Send users through `sanitizeUser` before JSON.
- **`/api/health`** returns 200/503 JSON (checks DB). Unknown `/api/*` returns
  JSON 404, not the SPA HTML fallback.
- **Secrets**: `.env`, `.env.production`, `.env.staging` are gitignored. Only the
  placeholder `.env.production.template` is committed.

## Git workflow

Develop on branch `claude/repo-setup-postiusgroup-3cux5c`; open PRs against `main`
as drafts. If that branch's PR is already merged, restart it from latest `main`
(same name) for follow-up work — never stack new commits on merged history.

## Current status (2026-07-15)

Production-ready and verified. Merged via PR #1 and PR #2:
- All TypeScript compiles; build passes.
- 8 production bugs fixed (health endpoint, `trust proxy`/login, password-hash
  leak, API 404s, Docker/Railway start path, `npm ci`→`install`, `.cjs` scripts,
  gitignored secrets) — found by running the app against real Postgres.
- CI + 11 Vitest smoke tests (auth + health) green.
- Deployment automation scripts in `scripts/`.

**Remaining**: the actual production deploy to dashboard.postiusgroup.com, which
needs the user's Railway/Neon/GitHub credentials. Nothing else is blocking.
