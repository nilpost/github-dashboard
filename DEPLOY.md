# DEPLOY.md — Deployment Runbook

Concise, ordered steps to deploy to **dashboard.postiusgroup.com**
(Railway + Cloudflare + PostgreSQL). For a guided/interactive path, run
`bash scripts/orchestrate-deployment.sh`. For deep detail, see
`POSTIUSGROUP_SETUP.md` and `DEPLOYMENT_AUTOMATION.md`.

## You must supply (cannot proceed without these)

1. **PostgreSQL** connection URL — e.g. Neon (https://neon.tech), free tier.
   `DATABASE_URL=postgresql://user:pass@host:5432/db`
2. **Railway** account (https://railway.app) + CLI auth.
3. **Cloudflare** access to the `postiusgroup.com` zone (to add DNS).
4. **GitHub** Personal Access Token, scopes `repo` + `read:user` (`ghp_…`).

## Steps

### 1. Prepare env

```bash
cp .env.production.template .env.production        # gitignored
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → SESSION_SECRET
# edit .env.production: set DATABASE_URL, SESSION_SECRET, GITHUB_TOKEN
node scripts/validate-env.cjs                      # verify format + DB reachability
```

### 2. Initialize the database

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
npm run db:push          # creates the 8 tables; session table is auto-created at runtime
```

### 3. Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init            # or: railway link  (to an existing project)
railway variables set DATABASE_URL="…" SESSION_SECRET="…" GITHUB_TOKEN="ghp_…" \
                      NODE_ENV=production PORT=8000
railway up
railway domain          # note the *.up.railway.app URL for Cloudflare
```

Railway builds from the committed `Dockerfile` (`railway.json` → `node dist/index.js`).

### 4. Point Cloudflare DNS at Railway

In the Cloudflare dashboard for `postiusgroup.com` (details: `scripts/cloudflare-setup.md`):

- **DNS → Add record**: `CNAME`, name `dashboard`, target `<your>.up.railway.app`, **Proxied**.
- **SSL/TLS**: mode **Full**; enable **Always Use HTTPS**.

### 5. Verify

```bash
node scripts/health-check.cjs https://dashboard.postiusgroup.com
# then in a browser: register a user, add the GitHub token in Settings, Sync.
```

`/api/health` should return `{"status":"ok","database":"connected"}`.

## Gotchas

- `PORT=8000` in prod; app also honors Railway's injected `$PORT`.
- Secure cookies require `NODE_ENV=production` (enables `trust proxy`) **and**
  real HTTPS via Cloudflare — otherwise login won't persist.
- If Railway build fails on `npm ci`: it shouldn't — the Dockerfile uses
  `npm install` because `package-lock.json` is gitignored.
- Rotate the GitHub token every ~90 days.
