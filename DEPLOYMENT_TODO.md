# Deployment TODO — `dashboard.postiusgroup.com`

Actionable checklist to take this app live on a subdomain. Work top to bottom.
For deep detail see **`DEPLOY.md`**, **`POSTIUSGROUP_SETUP.md`**, and
**`scripts/cloudflare-setup.md`**. This file captures the specific plan and the
decisions already made, so a fresh (local) session can execute without
re-deriving them.

## Decisions already made
- **Subdomain:** `dashboard` → `dashboard.postiusgroup.com`
- **Cloudflare record:** Proxied (orange cloud), TTL Auto
- **SSL/TLS mode:** Full (needed so Proxied + origin HTTPS don't loop) + Always Use HTTPS
- **Host:** Railway (container) + Neon PostgreSQL — the repo's supported path (`DEPLOY.md`)
- **Done = green:** `https://dashboard.postiusgroup.com/api/health` returns
  `{"status":"ok","database":"connected"}` and login persists in a browser

## Why this can't be done from a remote/cloud session
Two things block it remotely, both need local/credentialed action — hence this
handoff to a local session:
1. **No running origin the cloud tools can create.** The app is a stateful
   Express server (node-cron jobs, pg pool, session store) — it needs a real
   host (Railway), not Cloudflare's edge. Standing that up needs your Railway +
   Postgres credentials.
2. **DNS edits need a key to your Cloudflare account.** The connected Cloudflare
   MCP can't touch DNS; adding the record needs a Cloudflare API token (or the
   dashboard). 

---

## 0. Gather inputs first (blockers — collect before starting)
- [ ] **`DATABASE_URL`** — PostgreSQL connection string (Neon free tier is fine):
      `postgresql://user:pass@host:5432/db`
- [ ] **`SESSION_SECRET`** — 32+ bytes. Generate:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] **`GITHUB_TOKEN`** — `ghp_…`, scopes `repo` + `read:user`
- [ ] **Railway** account + CLI auth (`railway login`) — only if not already deployed
- [ ] **Cloudflare API token** — scoped to **Zone → DNS → Edit** *and*
      **Zone → Zone → Read** on `postiusgroup.com`. DNS:Edit alone creates the
      record, but the `GET /zones?name=…` lookup in section B needs Zone:Read
      (or grab the zone id from the dashboard and skip that call). SSL-mode
      changes additionally need Zone Settings edit or the dashboard.
- [ ] **Is the app already deployed?** If yes, note its origin
      (hostname like `myapp.up.railway.app`, or an IP) and **skip section A**.

---

## A. Deploy the app (skip if it already runs somewhere)
Ordered, from `DEPLOY.md`:
1. [ ] **Env:** `cp .env.production.template .env.production` (gitignored), fill
       `DATABASE_URL`, `SESSION_SECRET`, `GITHUB_TOKEN`, then
       `node scripts/validate-env.cjs` (verifies format + DB reachability).
2. [ ] **DB schema:** `export DATABASE_URL="…"` then `npm run db:push`
       (creates the 8 tables; `session` table auto-creates at runtime).
3. [ ] **Build sanity (optional):** `npm run check && npm run build`.
4. [ ] **Railway deploy:**
       ```
       npm install -g @railway/cli
       railway login
       railway init            # or: railway link
       railway variables set DATABASE_URL="…" SESSION_SECRET="…" \
           GITHUB_TOKEN="ghp_…" NODE_ENV=production PORT=8000
       railway up
       railway domain          # prints the default *.up.railway.app service URL
       ```
5. [ ] **Confirm the service is up** on its default Railway URL:
       `node scripts/health-check.cjs https://<app>.up.railway.app` → `{"status":"ok"}`.
6. [ ] **Register the custom domain IN Railway** — required. Pointing DNS at the
       default service host alone returns **404**: Railway routes by registered
       custom domain and issues the TLS cert for it.
       ```
       railway domain dashboard.postiusgroup.com
       ```
       (or Service → Settings → Networking → Custom Domain). Railway then shows the
       **exact CNAME target to use in section B** — copy it. That target is
       Railway's value for this custom host; it is **not** necessarily the default
       `*.up.railway.app` service URL. (If already deployed, do this step too and
       use the target it shows as your origin.)

---

## B. Point Cloudflare DNS at the origin (the subdomain step)
Do this via the Cloudflare API with `CLOUDFLARE_API_TOKEN`, or the dashboard
(`scripts/cloudflare-setup.md`).

1. [ ] **Find the zone id:**
       ```
       curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
         "https://api.cloudflare.com/client/v4/zones?name=postiusgroup.com" \
         | jq -r '.result[0].id'
       ```
2. [ ] **Create the record** (CNAME if origin is a hostname; A if it's an IP).
       `<ORIGIN_HOSTNAME>` = the **CNAME target Railway showed** in section A step 6
       (or your host's hostname if not on Railway):
       ```
       curl -s -X POST \
         -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
         -H "Content-Type: application/json" \
         "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
         -d '{"type":"CNAME","name":"dashboard","content":"<ORIGIN_HOSTNAME>","proxied":true,"ttl":1}'
       ```
       (For an IP origin: `"type":"A","content":"<IP>"`.)
3. [ ] **SSL/TLS:** set zone mode to **Full** and enable **Always Use HTTPS**
       (dashboard → SSL/TLS, or API with a Zone Settings token). Skipping this
       with a Proxied record can cause a redirect loop.
4. [ ] **If Railway's cert won't issue while Proxied:** Railway needs to provision
       a Let's Encrypt cert for the custom domain. If it stays stuck behind
       Cloudflare's proxy, temporarily set the record to **DNS only** (grey cloud)
       until Railway shows the domain as active/verified, then flip back to
       **Proxied**. Keep SSL/TLS mode on **Full**.

---

## C. Verify live
1. [ ] `dig +short dashboard.postiusgroup.com` resolves (Cloudflare IPs when proxied).
2. [ ] `node scripts/health-check.cjs https://dashboard.postiusgroup.com`
       → `{"status":"ok","database":"connected"}`.
3. [ ] Browser: register a user → run **Sync** → confirm login persists across a
       refresh (validates secure cookies). Do **not** try to save a token in
       Settings — `POST /api/settings/github-token` intentionally returns 501
       (per-user tokens aren't implemented); sync uses the server-wide
       `GITHUB_TOKEN` env var set during deploy.

---

## Gotchas (from DEPLOY.md)
- `PORT=8000` in prod; the app also honors Railway's injected `$PORT`.
- Secure cookies need `NODE_ENV=production` (enables `trust proxy`) **and** real
  HTTPS via Cloudflare — otherwise login silently won't persist.
- Proxied record + wrong origin SSL mode → redirect loop; use **Full**.
- `.env.production` is gitignored — never commit it. Keep the Cloudflare token
  and `GITHUB_TOKEN` out of the repo and out of command output/logs.
- Rotate the GitHub token ~every 90 days.
