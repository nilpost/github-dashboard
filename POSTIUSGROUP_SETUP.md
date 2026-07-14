# GitHub Dashboard - Postiusgroup.com Deployment Setup

> Production deployment guide for **dashboard.postiusgroup.com**

## 🎯 Subdomain Selection

**Recommended Subdomain**: `dashboard.postiusgroup.com`

**Why?**
- Clear and professional
- Immediately communicates purpose
- Easy to remember and type
- SEO-friendly

**Alternative Options**:
- `repos.postiusgroup.com` - Simpler, focuses on repository aspect
- `insights.postiusgroup.com` - Emphasizes analytics value  
- `monitor.postiusgroup.com` - Highlights monitoring capability

## ✅ Pre-Deployment Checklist

### Code Quality
- [x] TypeScript compilation passes (`npm run check`)
- [x] Production build succeeds (`npm run build`)
- [x] All type errors resolved
- [x] No security vulnerabilities in dependencies

### Infrastructure Prerequisites
- [ ] PostgreSQL database (Neon recommended)
- [ ] Railway account and project
- [ ] Cloudflare account with postiusgroup.com domain access
- [ ] GitHub Personal Access Token with repo scope

### Environment Setup
- [ ] Generate SESSION_SECRET (32+ characters)
- [ ] GitHub Personal Access Token obtained
- [ ] Database URL configured
- [ ] NODE_ENV set to "production"

## 📋 Step-by-Step Deployment

### Step 1: Prepare PostgreSQL Database

**Option A: Using Neon (Recommended)**
```bash
# 1. Go to https://neon.tech
# 2. Create new project
# 3. Get connection string
# 4. Keep it safe for environment variables
```

**Option B: Self-hosted PostgreSQL**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE github_dashboard;"

# Verify connection
psql "postgresql://user:pass@host:5432/github_dashboard" -c "SELECT 1"
```

### Step 2: Generate Required Environment Variables

```bash
# Generate SESSION_SECRET (secure random 32+ char string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example: 
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Keep this safe - it encrypts sessions!
```

### Step 3: Deploy to Railway

#### Option A: Railway CLI (Recommended for CI/CD)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project in repo root
cd /home/user/github-dashboard
railway init

# 4. Set environment variables
railway variables set DATABASE_URL="postgresql://user:pass@host/github_dashboard"
railway variables set SESSION_SECRET="your-32-char-secret-here"
railway variables set GITHUB_TOKEN="ghp_your_token_here"
railway variables set SYNC_INTERVAL_MINUTES="60"
railway variables set NODE_ENV="production"
railway variables set PORT="8000"

# 5. Deploy
railway up
```

#### Option B: Railway Web Dashboard

```
1. Go to https://railway.app/dashboard
2. Create new project
3. Select "Connect Repo" → GitHub → Select github-dashboard
4. Configure environment variables in dashboard
5. Railway auto-deploys on git push
```

### Step 4: Configure Cloudflare DNS

#### Access Cloudflare Dashboard
```
1. Go to https://dash.cloudflare.com
2. Select postiusgroup.com domain
3. Navigate to DNS section
```

#### Add CNAME Record
```
Type:    CNAME
Name:    dashboard
Target:  <your-railway-deployment-url>
         Example: github-dashboard-prod.up.railway.app
TTL:     Auto
Proxy:   Proxied (Orange Cloud)
```

#### SSL/TLS Settings
```
1. Go to SSL/TLS settings
2. Set mode to "Flexible" or "Full" (Full is more secure)
3. Enable "Always Use HTTPS"
```

#### Optional: HTTP → HTTPS Redirect
```
1. Go to Rules > Page Rules
2. Create rule:
   URL: http://dashboard.postiusgroup.com/*
   Redirect to: https://dashboard.postiusgroup.com/$1
   Code: 301
```

### Step 5: Initialize Database

After first Railway deployment:

```bash
# Option A: Via Railway Shell
railway shell
npm run db:push

# Option B: Via Environment Variable
DATABASE_URL="your-db-url" npm run db:push

# Verify tables created
railway shell
psql -c "\dt"
```

### Step 6: First-Time Application Setup

```
1. Access: https://dashboard.postiusgroup.com
2. Click "Register" to create account
3. Enter username, email, password
4. Log in with your credentials
5. Navigate to Settings (gear icon)
6. Enter your GitHub Personal Access Token
7. Click "Sync Now" to perform initial sync
8. Verify repositories appear on dashboard
```

## 🔍 Verification Checklist

After deployment, verify:

- [ ] HTTPS works: https://dashboard.postiusgroup.com
- [ ] HTTP redirects to HTTPS
- [ ] Login page loads
- [ ] Can register new user
- [ ] Can log in
- [ ] Dashboard displays (may be empty if no token configured)
- [ ] Settings page accessible
- [ ] GitHub token validation works
- [ ] Repository sync completes

## 📊 Production Environment Variables

**Required** for production:
```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SESSION_SECRET=<32+ character random string>
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
NODE_ENV=production
PORT=8000
```

**Optional**:
```env
SYNC_INTERVAL_MINUTES=60          # How often to check for vulnerabilities (default: 60)
LOG_LEVEL=info                    # Logging level (default: info)
```

**Never commit these to git!** Use Railway dashboard or `.env.production` (in .gitignore).

## 🚀 Monitoring & Maintenance

### View Logs
```bash
# Railway CLI
railway logs

# Or via dashboard: Railway > Project > Deployments > Logs
```

### Health Check Endpoint
Add to Railway health checks:
```
Endpoint: https://dashboard.postiusgroup.com/api/health
Method: GET
Timeout: 30s
Interval: 60s
```

### Performance Monitoring
Monitor in Railway dashboard:
- CPU usage (should be <50% idle)
- Memory usage (should be <200MB)
- Network I/O
- Disk space

### Database Maintenance
- Monthly: Review slow queries
- Monthly: Cleanup old logs (keep 1 year)
- Quarterly: Backup production database

### Dependency Updates
```bash
# Check for outdated packages
npm outdated

# Update packages (use caution in production)
npm update

# Or update specific package
npm update @octokit/rest
```

### SSL Certificate Renewal
- Cloudflare handles auto-renewal (no action needed)
- Railway provides free SSL
- No manual renewal required

## 🔐 Security Hardening

### GitHub Token Scope
Required scopes for token:
```
✓ repo (full control of private repositories)
✓ read:user (read user profile)
✗ workflow (not needed)
✗ write:repo_hook (not needed)
```

Rotate token every 90 days.

### Environment Variable Security
- Use Railway's encrypted variable storage
- Never log sensitive values
- Use different tokens for staging/production
- Regularly audit token usage

### Database Security
- Use strong passwords (32+ character random)
- Enable SSL connection to database
- Restrict database IP whitelist to Railway IPs only
- Regular backups (Neon handles this)

### Application Security
- HTTPS enforced (via Cloudflare + Railway)
- Secure cookies (httpOnly, sameSite=lax)
- Session expiry: 24 hours
- CSRF protection via session

## 🐛 Troubleshooting

### 502 Bad Gateway
```bash
# Check if application is running
railway logs

# Verify environment variables set
railway variables list

# Check database connection
DATABASE_URL="..." npm run db:push
```

### Database Connection Errors
```bash
# Test connection
psql "your-database-url" -c "SELECT 1"

# Verify DATABASE_URL format
postgresql://user:password@host.neon.tech/database

# Check Cloudflare DNS
dig dashboard.postiusgroup.com
```

### GitHub API Errors
```bash
# Verify token is valid and has required scopes
# Check rate limits: curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit

# Token may have expired - regenerate and redeploy
```

### High CPU/Memory Usage
- Increase Railway instance size
- Reduce SYNC_INTERVAL_MINUTES
- Optimize database queries
- Scale horizontally (add replicas)

### Sync Not Running
```bash
# Check logs for job errors
railway logs | grep -i "sync\|job\|vulnerability"

# Verify background jobs initialized
railway logs | grep -i "initializing"

# Check cron expression validity
# Current: "0 2 * * *" = 2 AM daily
```

## 📚 Reference Documentation

- **Main README**: [README.md](README.md)
- **Development Guide**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Original Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Tools Strategy**: [TOOLS_INTEGRATION_STRATEGY.md](TOOLS_INTEGRATION_STRATEGY.md)

## 🆘 Support & Escalation

**Issue**: Can't connect to database
- Whitelist Railway IP addresses in database firewall
- Verify DATABASE_URL has correct credentials
- Check if database server is running

**Issue**: GitHub API rate limited
- Using personal token (rate limit: 5000/hour)
- Wait for rate limit reset
- Consider GitHub App instead (higher limits)

**Issue**: SSL certificate errors
- Force refresh Cloudflare cache
- Verify CNAME record points to Railway
- Wait 24 hours for DNS propagation

**Issue**: Performance degradation
- Check Railway metrics dashboard
- Review slow query logs
- Scale database if needed
- Increase sync interval

## ✨ Post-Deployment Enhancements

After successful deployment, consider:

1. **Monitoring Alerts**
   - Set up Railway alerts for CPU/memory
   - Email notifications on deployment failures
   - Slack integration for real-time updates

2. **Database Optimization**
   - Add indexes on frequently queried fields
   - Partition large tables
   - Enable connection pooling

3. **API Caching**
   - Cache GitHub API responses
   - Redis for session store (if needed)
   - CDN for static assets

4. **Team Features**
   - Multi-user support
   - Role-based access control
   - Activity logging

---

**Last Updated**: 2026-07-14
**Deployment Status**: Ready for production
**Domain**: dashboard.postiusgroup.com
**Environment**: Railway + Cloudflare
