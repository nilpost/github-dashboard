# Backlog

Tracked follow-up work. Newest / highest-priority near the top. Items here are
deferred, not blocking — see `CLAUDE.md` for current status.

## Tech debt / polish

- [ ] **Paginate Dependabot alert fetching.** `vulnerabilityService.fetchGitHubDependabotAlerts`
  and `fetchGitHubDependabotAlertsWithHistory` (`server/services/vulnerability.service.ts`)
  request `per_page: 100` but only read the first page. A repository with more
  than 100 open (or open + dismissed) alerts would silently drop the rest.
  Loop over pages until a short page is returned, like `githubService.listRepositories`
  already does.

- [ ] **Document the auth rate-limiter test skip.** `authLimiter` in
  `server/routes.ts` uses `skip: () => process.env.NODE_ENV === "test"` for
  test determinism. This is intentional, but add a one-line note in a security
  runbook / comment so a future reviewer doesn't read it as an oversight and
  the limiter's production behavior stays clearly documented.

## Security (defense-in-depth)

- [ ] **Resolve the dev-only `vite` advisory.** `npm audit` reports a HIGH on
  `vite` (path-traversal, Windows-focused). It's a dev dependency, not on a
  runtime path, so it doesn't affect production — clear it on the next
  routine dependency bump.

## Deployment

- [ ] **Production deploy to `dashboard.postiusgroup.com`.** Blocked on the
  user's credentials (Railway account, Neon Postgres URL, Cloudflare zone
  access, GitHub PAT). Everything else is ready — see `DEPLOY.md`.
