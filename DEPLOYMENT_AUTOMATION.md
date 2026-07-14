# GitHub Dashboard - Deployment Automation Guide

> Automated deployment scripts for Railway + Cloudflare

## Quick Start

### Master Orchestrator (Recommended)
The easiest way to deploy everything:

```bash
bash scripts/orchestrate-deployment.sh
```

This single script will:
1. Verify your system and code
2. Set up environment variables
3. Configure Railway
4. Initialize database
5. Deploy application
6. Guide Cloudflare setup
7. Run health checks

**Time to complete**: ~10-20 minutes

---

## Individual Scripts

Use these for specific tasks or when you need more control.

### 1. Environment Validation
Validates all required environment variables:

```bash
node scripts/validate-env.js
```

**What it does:**
- Checks DATABASE_URL format
- Validates SESSION_SECRET (32+ chars)
- Verifies GITHUB_TOKEN format
- Confirms NODE_ENV setting
- Tests database connectivity

**When to use:**
- Before any deployment
- After updating .env.production
- Troubleshooting connection issues

---

### 2. Deployment Preparation
Prepares your repository for deployment:

```bash
bash scripts/deploy.sh
```

**What it does:**
- Verifies all prerequisites
- Checks Node.js and npm installation
- Validates Railway CLI
- Builds application
- Generates environment template
- Creates deployment plan and checklist

**Output files:**
- `.env.production.template` - Use to create .env.production
- `/tmp/deployment-plan.txt` - Detailed deployment steps
- `/tmp/deployment-checklist.md` - Verification checklist

**When to use:**
- Initial deployment setup
- Before creating Railway project

---

### 3. Database Initialization
Sets up PostgreSQL and runs migrations:

```bash
export DATABASE_URL="postgresql://user:password@host/database"
bash scripts/init-db.sh
```

**What it does:**
- Tests database connection
- Creates schema (drops existing if needed)
- Runs Drizzle migrations
- Verifies table creation
- Lists created tables

**Requirements:**
- DATABASE_URL environment variable set
- PostgreSQL database already created
- Network access to database

**When to use:**
- After creating PostgreSQL database
- Before deploying application
- For schema updates

---

### 4. Health Check Monitor
Verifies deployed application is working:

```bash
# For production
node scripts/health-check.js

# For custom URL
node scripts/health-check.js https://custom-url.com
```

**What it checks:**
- HTTPS connectivity
- HTTP to HTTPS redirect
- SSL/TLS certificate
- Login page loads
- API health endpoint
- Response time performance

**Exit codes:**
- `0`: Healthy and ready
- `1`: Critical issues detected

**When to use:**
- After initial deployment
- Post-deployment verification
- Periodic health monitoring
- Before production launch

---

### 5. Deployment Status Monitor
Shows current deployment status:

```bash
node scripts/deployment-status.js
```

**What it shows:**
- Git repository status
- Environment variable status
- Deployment configuration files
- Application accessibility
- HTTPS certificate info

**When to use:**
- Check deployment readiness
- Monitor production application
- Verify all systems before launch

---

### 6. Cloudflare Setup Guide
Manual configuration guide for DNS:

```bash
cat scripts/cloudflare-setup.md
```

**Content:**
- Step-by-step DNS configuration
- SSL/TLS setup
- HTTPS redirect rules
- Verification commands
- Troubleshooting guide
- Security hardening

**When to use:**
- After Railway deployment
- Before making application public
- For DNS and security configuration

---

## Deployment Workflow

### Standard Flow (Recommended)

```bash
# Step 1: Run master orchestrator
bash scripts/orchestrate-deployment.sh

# Step 2: Follow on-screen prompts
# - Configure environment
# - Create database
# - Deploy to Railway
# - Setup Cloudflare DNS

# Step 3: Manual Cloudflare configuration
# - Open scripts/cloudflare-setup.md
# - Configure DNS CNAME record
# - Enable HTTPS

# Step 4: Monitor deployment
node scripts/health-check.js
node scripts/deployment-status.js
```

### Advanced Flow (Manual Control)

```bash
# Step 1: Preparation
bash scripts/deploy.sh

# Step 2: Environment Setup
cp .env.production.template .env.production
# Edit .env.production with your values
node scripts/validate-env.js

# Step 3: Database Setup
export DATABASE_URL="your-database-url"
bash scripts/init-db.sh

# Step 4: Railway Deployment
railway login
railway link
railway variables set DATABASE_URL="$DATABASE_URL"
railway variables set SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
railway variables set GITHUB_TOKEN="ghp_your_token"
railway up

# Step 5: Cloudflare Configuration
# Manual setup following scripts/cloudflare-setup.md

# Step 6: Verification
node scripts/health-check.js
node scripts/deployment-status.js
```

---

## Environment Variables

### Required Variables

```bash
# Database connection string
DATABASE_URL=postgresql://user:password@host:5432/database

# Session encryption secret (generate with below)
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# GitHub Personal Access Token
# Scopes needed: repo, read:user
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Application environment
NODE_ENV=production
```

### Optional Variables

```bash
# Application port (default: 8000)
PORT=8000

# Background sync interval in minutes (default: 60)
SYNC_INTERVAL_MINUTES=60

# Logging level (default: info)
LOG_LEVEL=info
```

### Generating SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## Docker Deployment

The included `Dockerfile` supports Railway's container deployment:

### Building Locally

```bash
docker build -t github-dashboard:latest .
```

### Running Container

```bash
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  -e GITHUB_TOKEN="ghp_token" \
  -e NODE_ENV="production" \
  github-dashboard:latest
```

---

## Troubleshooting

### "Cannot connect to database"

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection directly
psql "$DATABASE_URL" -c "SELECT 1"

# Check format
# Should be: postgresql://user:password@host:5432/database
```

### "Railway deployment failed"

```bash
# Check logs
railway logs

# Verify environment variables
railway variables list

# Check application status
railway status
```

### "Application not responding after deployment"

```bash
# Run health check
node scripts/health-check.js

# Check Railway logs
railway logs | grep -i error

# Verify database is initialized
railway shell
npm run db:push
```

### "DNS not resolving"

```bash
# Check CNAME record
dig dashboard.postiusgroup.com

# Force cache clear (Cloudflare)
# Dashboard > Caching > Cache Purge > Purge Everything

# Wait for propagation (up to 24 hours)
```

### "SSL certificate errors"

```bash
# Check certificate
openssl s_client -connect dashboard.postiusgroup.com:443 -servername dashboard.postiusgroup.com

# Verify Cloudflare SSL/TLS mode is "Full"
# Verify Railway supports HTTPS
```

---

## Monitoring & Maintenance

### Daily Checks

```bash
# Application health
node scripts/health-check.js

# Deployment status
node scripts/deployment-status.js

# Railway logs
railway logs --tail 100
```

### Weekly Tasks

```bash
# Update dependencies
npm outdated

# Check for security vulnerabilities
npm audit

# Review application logs for errors
railway logs | grep -i error
```

### Monthly Tasks

```bash
# Database maintenance
railway shell
# Check slow queries and cleanup old logs

# Dependency updates
npm update

# Backup database
# (Handled by Neon for PostgreSQL)
```

---

## Performance Optimization

### Reduce Response Times

```bash
# Increase Railway instance size (if needed)
railway resource upgrade

# Check database connection pooling
railway shell
# Monitor active connections
```

### Reduce Database Load

```bash
# Adjust sync interval (default: 60 minutes)
railway variables set SYNC_INTERVAL_MINUTES="120"

# Enable caching in application
# See DEVELOPMENT.md for optimization tips
```

### Optimize Cloudflare

```bash
# Enable caching for static assets
# Go to Caching > Cache Rules
# Add rules for /images, /css, /js paths

# Enable Cloudflare Analytics
# Monitor cache hit ratio and performance
```

---

## Security Hardening

### Environment Variables

```bash
# Use Railway's encrypted storage
railway variables set SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"

# Rotate GitHub token every 90 days
# GitHub Settings > Developer Settings > Personal access tokens

# Use strong database password (32+ random characters)
# Database should require SSL connection
```

### Application Security

```bash
# Enable HSTS (via Cloudflare)
# SSL/TLS > Edge Certificates > Always Use HTTPS

# Enable WAF rules
# Security > WAF > Enable Cloudflare Managed Ruleset

# Enable rate limiting
# Security > Rate limiting > Add custom rule
```

---

## Getting Help

### Logs

```bash
# Application logs
railway logs

# Real-time tail
railway logs --tail

# Filter by error
railway logs | grep -i error
```

### Status

```bash
# Deployment status
node scripts/deployment-status.js

# Health check
node scripts/health-check.js

# Railway status
railway status
```

### Documentation

- **Setup**: POSTIUSGROUP_SETUP.md
- **Development**: DEVELOPMENT.md
- **Cloudflare**: scripts/cloudflare-setup.md
- **Railway Docs**: https://docs.railway.app
- **Cloudflare Docs**: https://developers.cloudflare.com

---

## Quick Reference

| Task | Command |
|------|---------|
| Master deployment | `bash scripts/orchestrate-deployment.sh` |
| Validate environment | `node scripts/validate-env.js` |
| Initialize database | `bash scripts/init-db.sh` |
| Check application health | `node scripts/health-check.js` |
| View deployment status | `node scripts/deployment-status.js` |
| View Railway logs | `railway logs` |
| Connect to application | `railway shell` |
| Update environment | `railway variables set KEY=VALUE` |
| Redeploy application | `railway up` |
| View Cloudflare DNS | https://dash.cloudflare.com |

---

**Last Updated**: 2026-07-14  
**Status**: Production Ready  
**Maintenance**: Actively Monitored
