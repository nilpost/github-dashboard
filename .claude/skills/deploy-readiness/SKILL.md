---
name: deploy-readiness
description: >-
  Take a project from "looks done" to deploy-ready with zero errors. Use when
  asked to review a repo, verify it runs, make the code correct, prepare/verify a
  deployment, or set up CI or tests. Verifies by actually running the app (not
  just type-check), fixes production-readiness bugs, adds CI + smoke tests, and
  documents for session continuity. Pairs with the studio-core learning loop:
  recall prior lessons at the start, capture new ones at the end.
---

# Deploy-readiness playbook

Goal: a project that **builds, type-checks, tests, and actually runs** — verified,
documented, and CI-gated — so it can be deployed without surprises.

> Learning loop: if the **studio-core** plugin is installed (see
> `.claude/settings.json`), run its `recall-learnings` skill first to surface
> prior lessons, and `capture-learnings` (or `/learn`) at the end to record new
> ones into the cross-project knowledge base. That is where durable, transferable
> lessons live now — this skill is the process; the knowledge base is the memory.

## Process

1. **Orient.** Read `CLAUDE.md`, `README`, `package.json` scripts. Identify stack,
   entry point, build-output path, and how the app boots (DB, sessions, jobs,
   proxy assumptions). Recall relevant past lessons.

2. **Make it compile.** Install deps, run the type-check and build. Fix real type
   errors; don't paper over them beyond what the codebase already accepts.

3. **Verify by RUNNING — the important step.** Boot the app against real
   dependencies (stand up a throwaway Postgres/etc. if needed) and drive the actual
   flows end to end. Check happy path and failure path. Compiling is not working.

4. **Fix production-readiness bug classes:**
   - **Lying health check.** An SPA catch-all (`app.get("*", …)`) serves
     `index.html` (200) for `/api/health` and unknown `/api/*`. Add a real health
     route that checks the DB and returns 200/503 JSON; return JSON 404 for unknown
     `/api/*` before the SPA fallback.
   - **Auth behind a TLS proxy.** With `secure` cookies you must set `trust proxy`
     or the session cookie is never issued and **login silently fails in prod**.
   - **Secret leakage.** Don't return password hashes / internal fields; sanitize
     user objects at the response boundary.
   - **Build-output/start-path drift.** Point the start command at the file the
     bundler actually emits; prefer `npm start` in Docker/CI.
   - **`npm ci` vs gitignored lockfile.** No committed lockfile → use `npm install`.
   - **ESM `.cjs`.** In `"type":"module"` projects, `require()` scripts must be `.cjs`.
   - **Secrets in git.** `.env` doesn't ignore `.env.production` — ignore each
     explicitly; commit only placeholder `*.template`.

5. **CI + smoke tests.** Add/verify a CI workflow (install → check → build →
   migrate → test) with the real service containers it needs. Add a `createApp()`
   factory if missing so endpoints are testable in-process; write smoke tests for
   health and the auth/session round-trip.

6. **Document for continuity.** Ensure `CLAUDE.md` (auto-loaded context) and a
   command-forward `DEPLOY.md` runbook exist and are current. Record new gotchas.

7. **Deployment.** Automate everything up to the credential boundary; make the
   manual, user-credential steps explicit. Don't attempt the real deploy without
   the user's accounts/tokens.

8. **Capture learnings.** When the project is deploy-ready (build + type-check +
   tests green, app verified running), capture any new transferable lesson via the
   studio-core loop (`/learn`) so it propagates to every environment.

## Working agreement

- Prefer acting over narrating; run independent checks in parallel.
- Report faithfully: if something fails, say so with the output; only call it done
  when verified by running.
- Keep changes in focused draft PRs against `main`; never stack on merged history.
