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
8000), `SYNC_INTERVAL_MINUTES` (60), `LOG_LEVEL` (info),
`STUDIO_OPS_REPO` / `STUDIO_OPS_PATH` (portfolio cockpit — see below).

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

## You cannot `npm install` from the Google Drive path

This repo lives under `G:\My Drive\...`. **`npm install` fails there** — it errors with
`EBADF: bad file descriptor, write` partway through, then rolls back, leaving a
`node_modules/` that exists but has an empty `.bin/` and no resolvable packages. The
Drive sync client does not provide the file semantics npm needs, the same root cause
that corrupted this workspace's git object stores.

Symptoms that mean you have hit this: `'tsc' is not recognized`, or
`Cannot find module 'typescript/package.json'` when `node_modules/typescript` clearly
exists. Note that `npm install | tail` will report success — the exit status comes from
the pipe, not from npm — so check the log, not the exit code.

**Workaround: clone somewhere off the Drive and work there.**

```bash
git clone "G:/My Drive/Claude-Sync/githubdashboard/github-dashboard" C:/dev/github-dashboard
cd C:/dev/github-dashboard && npm install     # ~2 min, vs. failing outright on the Drive
```

Verified 2026-07-30: install, `npm run check`, `npm run build`, and the unit suite all
pass on local disk and none of them can run on the Drive path.

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

## Portfolio cockpit (`/portfolio`)

A second view on top of the repo dashboard: **what should I work on next, and what
is blocked?** It renders the studio's portfolio — stages, next gates, blockers, WIP
limit, kill proposals, and revenue candidates.

- `server/services/portfolio.service.ts` fetches `portfolio.json` from the ops repo
  via the existing `githubService.getFileContent`, validates it, and caches for 5
  minutes. `GET /api/portfolio`; `POST /api/portfolio/refresh` busts the cache.
- `client/src/pages/portfolio-page.tsx` renders it.

**There is deliberately no `portfolio_projects` table.** `portfolio.json` in the ops
repo is canonical; mirroring it into Postgres would create a second source of truth
that drifts, and it is ~15 rows. This service is a read-through view and never
writes back. Do not "improve" this by adding a table without a reason that
outweighs the drift.

Unconfigured is a **normal state**, not an error: with `STUDIO_OPS_REPO` unset the
endpoint returns 200 with `configured: false` and a human-readable reason, and the
page renders that reason. Same for a missing file, an unparseable file, or a token
without access. Nothing here may take the dashboard down.

## Reusable capabilities (studio-core plugin)

This repo installs the **studio-core** plugin via `.claude/settings.json` (the
`claude-code-studio` marketplace, GitHub source). It loads automatically in every
local and cloud session and provides:

- **Shared agents** — `po` (Product Owner orchestrator), `code-review`, `qa`,
  `devops`, `security`, `docs`, `infra-admin`, `backlog`, `feature-planning`.
- **Incremental-learning loop** — `recall-learnings` (surface prior lessons at
  start) and `capture-learnings` skills + the `/learn` command, backed by a
  cross-project knowledge base (`knowledge/LEARNINGS.md` in that repo).

Locally, **`.claude/skills/deploy-readiness/`** adds a deploy-readiness playbook
for this project. Rule: when a project reaches deploy-ready (build + type-check +
tests green, app verified running), capture new lessons via the studio loop
(`/learn`) so they propagate to every environment.

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
