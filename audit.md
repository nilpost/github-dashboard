# Security policy

## Supported versions

Only the latest commit on the default branch is supported. Historical commits, forks, and unmaintained deployments are unsupported.

## Private vulnerability reporting

Use GitHub private vulnerability reporting from the repository's **Security** tab, or contact the owner privately through the contact method on the owner's GitHub profile if unavailable. Include affected paths, reproduction conditions, impact, and a minimal proof of concept. Do not send real GitHub tokens or private repository data.

Do **not** disclose vulnerabilities through public GitHub issues, discussions, or pull requests before coordinated disclosure.

## Security expectations

- Keep the dashboard behind an explicit invite/identity boundary and use least-privilege GitHub credentials.
- Never use self-registration as authorization to server-wide private GitHub data.
- Enforce repository ownership on every repository-scoped operation.
- Keep CSRF, secure session cookies, rate limiting, and response sanitization enabled in production.

# Security & Privacy Remediation Backlog

- [ ] **GITHUB-DASHBOARD-001 — MEDIUM — Broken access control / private portfolio exposure**
  - **Affected files/lines:** `server/routes.ts:68-102`, `474-491`; `server/services/portfolio.service.ts:119-166`
  - **Description:** Public self-registration creates an authenticated local account, and every authenticated account can read or refresh the server-wide portfolio. The portfolio service uses the deployment's `GITHUB_TOKEN` to fetch the configured ops repository, including a private repository, without checking that the local user is an approved operator.
  - **Exposure path:** An Internet attacker registers an arbitrary account, obtains a session, then requests `/api/portfolio`; the server reads `portfolio.json` with its privileged GitHub token and returns it.
  - **Impact:** Unauthorized disclosure of private repository portfolio contents, project status, blockers, decisions, and operational metadata available to the server token.
  - **Confidence:** HIGH — open registration, authentication-only portfolio routes, and server-token-backed private repository reads are explicit in source.
  - **Remediation:** Disable public registration for this internal dashboard or require an invite/approved identity allowlist; authorize portfolio access with an operator role independent of mere login; scope the GitHub token to only necessary repositories and fields; add an unapproved-account denial test.
  - **Status:** OPEN
