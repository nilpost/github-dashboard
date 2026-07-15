# LEARNINGS.md

Reusable, transferable learnings for taking a project from "looks done" to
**deploy-ready with zero errors**. Consumed by the `@po` agent and the
`deploy-readiness` skill (`.claude/`).

**Maintenance rule:** whenever a project reaches deploy-ready (build + type-check
+ tests all green, app verified running), append/refresh the relevant learnings
here and add a dated entry to the Changelog at the bottom. Keep items general so
they transfer to other projects — put project-specific detail in `CLAUDE.md`.

---

## 1. Verify by running — not just by compiling

- A green `tsc`/build proves it compiles, **not that it works**. Boot the app and
  exercise the real flows before calling it done.
- Stand up real dependencies locally (e.g. a throwaway Postgres) and drive the
  actual endpoints. Most of the serious bugs below were invisible to the compiler
  and only surfaced when the server was actually running.
- Test both the happy path and the failure path (DB up **and** DB down).

## 2. Production-readiness bug classes to check every time

- **Health check that lies.** An SPA catch-all (`app.get("*", …)`) will happily
  serve `index.html` for `/api/health`, so the check returns 200 even when the
  backend/DB is down. Add a *real* health route that verifies the DB and returns
  200/503 JSON. Make unknown `/api/*` return JSON 404, not the SPA HTML.
- **Auth behind a TLS-terminating proxy.** Railway/Cloudflare terminate HTTPS and
  forward plain HTTP. With `secure` cookies you must set `trust proxy` or the
  session cookie is never issued and **login silently fails in production**.
- **Secret leakage in responses.** Don't return password hashes / internal fields.
  Route user objects through a `sanitizeUser`-style allowlist before serializing.
- **Build-output path drift.** Confirm the start command points at the file the
  bundler actually emits (here: esbuild → `dist/index.js`, not `dist/server/…`).
  A wrong path crashes the container on boot. Prefer `npm start` in Docker/CI so
  it stays in sync with `package.json`.
- **`npm ci` needs a committed lockfile.** If `package-lock.json` is gitignored,
  `npm ci` fails on a clean CI/Docker build — use `npm install` (or commit the lock).
- **ESM vs CommonJS.** In a `"type": "module"` project, standalone Node scripts
  using `require()` must be `.cjs`, or they crash. Update every reference.
- **Secrets in git.** `.env` alone does not ignore `.env.production` — add each
  real env file explicitly and commit only a placeholder `*.template`.

## 3. CI & tests

- Add CI early: install → type-check → build → migrate → test, on every PR and
  push to the default branch. It's the automated pass/fail signal.
- Give CI the **real services** it needs (e.g. a `postgres:16` service container)
  and run migrations before tests, mirroring how the app actually boots.
- Structure for testability: extract a `createApp()` factory so the app can be
  driven in-process (supertest) without binding a port or starting cron jobs;
  keep the listener + background jobs in the entry file.
- Smoke tests worth having: health 200/JSON-404, register (no secret leak),
  duplicate rejection, **session persistence across requests**, login success +
  wrong-password 401, unauthenticated 401.

## 4. Docs & session continuity

- Add a `CLAUDE.md` at the repo root — it auto-loads, so a fresh session starts
  with full context and near-zero re-derivation cost. Keep it tight and link out.
- Add a command-forward `DEPLOY.md` runbook so deployment is "follow the steps,"
  not a re-investigation. List exactly what the user must supply (credentials).
- Record the conventions/gotchas that cost time so they aren't rediscovered.

## 5. Deployment shape (Railway + Cloudflare + Postgres)

- Postgres (Neon free tier is fine) → `db:push` schema → Railway (Docker build,
  env vars set) → Cloudflare CNAME (Proxied) + SSL "Full" + Always-HTTPS →
  verify `/api/health` and a real login in the browser.
- Real deployment needs the user's accounts/tokens; automate everything up to
  that boundary and make the manual steps explicit.

## 6. Working style

- Prefer acting over narrating; make independent tool calls in parallel.
- Keep PRs as focused drafts against `main`; never stack new commits on
  already-merged history (restart the branch from `main` instead).
- Be frugal with outward-facing actions (PR comments); the diff is the record.

---

## Changelog

- **2026-07-15 — github-dashboard**: Initial learnings. Found & fixed 8
  production-readiness bugs by running the app against real Postgres (health
  endpoint, `trust proxy`/login, password-hash leak, API 404, Docker/Railway
  start path, `npm ci`→`install`, `.cjs` scripts, gitignored secrets); added CI
  + 11 Vitest smoke tests; added `CLAUDE.md`/`DEPLOY.md`. All green.
