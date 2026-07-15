---
name: deploy-readiness
description: >-
  Take a project from "looks done" to deploy-ready with zero errors, using the
  learnings in LEARNINGS.md. Use when asked to review a repo, verify it runs,
  make the code correct, prepare/verify a deployment, set up CI or tests, or when
  the user invokes @po. Verifies by actually running the app (not just
  type-check), fixes production-readiness bugs, adds CI + smoke tests, documents
  for session continuity, and refreshes LEARNINGS.md when the project is green.
---

# Deploy-readiness playbook

Goal: a project that **builds, type-checks, tests, and actually runs** — verified,
documented, and CI-gated — so it can be deployed without surprises. Apply the
transferable knowledge in `LEARNINGS.md` (read it first; it is the source of truth).

## Process

1. **Orient.** Read `CLAUDE.md`, `README`, `package.json` scripts, and
   `LEARNINGS.md`. Identify stack, entry point, build output path, and how the app
   boots (DB, sessions, jobs, proxy assumptions).

2. **Make it compile.** Install deps, run the type-check and build. Fix real type
   errors; don't paper over them beyond what the codebase already accepts.

3. **Verify by RUNNING — the important step.** Boot the app against real
   dependencies (stand up a throwaway Postgres/etc. if needed) and drive the actual
   flows end to end. Check happy path and failure path. Compiling is not working.

4. **Fix production-readiness bug classes** (see `LEARNINGS.md` §2): lying health
   checks / SPA-swallowed `/api/*`, auth behind a TLS proxy (`trust proxy` +
   secure cookies), secret leakage in responses, build-output/start-path drift,
   `npm ci` vs gitignored lockfile, ESM `.cjs` scripts, secrets committed to git.

5. **CI + smoke tests** (§3): add/verify a CI workflow (install → check → build →
   migrate → test) with the real service containers it needs. Add a `createApp()`
   factory if missing so endpoints are testable in-process; write smoke tests for
   health and the auth/session round-trip.

6. **Document for continuity** (§4): ensure `CLAUDE.md` (auto-loaded context) and a
   command-forward `DEPLOY.md` runbook exist and are current. Record new gotchas.

7. **Deployment** (§5): automate everything up to the credential boundary; make the
   manual, user-credential steps explicit. Don't attempt the real deploy without
   the user's accounts/tokens.

8. **Close the loop — refresh learnings.** When the project is deploy-ready (build
   + type-check + tests green, app verified running), update `LEARNINGS.md`:
   fold in any new transferable lesson and add a dated Changelog entry naming the
   project. This is required, not optional — it's how @po gets better each time.

## Working agreement

- Prefer acting over narrating; run independent checks in parallel.
- Report faithfully: if something fails, say so with the output; only call it done
  when verified by running.
- Keep changes in focused draft PRs against `main`; never stack on merged history.
