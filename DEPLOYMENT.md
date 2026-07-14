# GitHub Dashboard Deployment Guide

This guide covers deploying the GitHub Dashboard to Railway and configuring Cloudflare DNS.

## Prerequisites

- Railway account (https://railway.app)
- Cloudflare account with postiusgroup.com domain
- PostgreSQL database (Neon recommended)
- GitHub Personal Access Token

## Step 1: Prepare Environment Variables

Create environment variables needed for deployment:

```env
DATABASE_URL=postgresql://user:password@neon-db.neon.tech/github_dashboard
SESSION_SECRET=<generate-32-char-random-string>
GITHUB_TOKEN=<your-github-personal-access-token>
SYNC_INTERVAL_MINUTES=60
NODE_ENV=production
PORT=8000
```

### Generating SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Set Up PostgreSQL Database

### Using Neon (Recommended)

1. Create account at https://neon.tech
2. Create a new project
3. Get connection string in format: `postgresql://user:password@host/database`
4. Optionally, enable IP whitelist or allow all IPs for Railway

### Manual Database Setup

If using your own PostgreSQL:
- Ensure TCP/IP connections are enabled
- Create a new database: `CREATE DATABASE github_dashboard;`
- Whitelist Railway's IP addresses (or set to 0.0.0.0 for testing, then restrict)

## Step 3: Deploy to Railway

### Method 1: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd dashboard
railway init

# Configure environment variables
railway variables set DATABASE_URL=<your-db-url>
railway variables set SESSION_SECRET=<your-secret>
railway variables set GITHUB_TOKEN=<your-token>
railway variables set SYNC_INTERVAL_MINUTES=60
railway variables set NODE_ENV=production

# Deploy
railway up
```

### Method 2: Using Railway Dashboard

1. Go to https://railway.app/dashboard
2. Create new project
3. Connect GitHub repository
4. Select the `dashboard` directory
5. Configure environment variables in Railway dashboard
6. Railway will auto-deploy on git push to main branch

## Step 4: Configure Cloudflare DNS

### Connect postiusgroup.com to Railway

1. Get Railway deployment URL from Railway dashboard
   - Format: `something-production.up.railway.app` or `railway-app-id.railway.app`

2. In Cloudflare dashboard:
   - Go to DNS settings for postiusgroup.com
   - Add CNAME record:
     ```
     Type: CNAME
     Name: @ (root)
     Target: <railway-deployment-url>
     TTL: Auto
     Proxy Status: Proxied (orange cloud)
     ```

3. Alternative: If using subdomains
   ```
   Type: CNAME
   Name: dashboard
   Target: <railway-deployment-url>
   TTL: Auto
   Proxy Status: Proxied
   ```

### SSL/TLS Configuration

1. In Cloudflare dashboard:
   - Go to SSL/TLS settings
   - Set mode to "Flexible" or "Full"
   - Railway provides free HTTPS

2. Optional: Enable auto-redirect
   - Go to Rules > Page Rules
   - Create rule: `http://postiusgroup.com/*` → redirect to `https://postiusgroup.com/$1`

## Step 5: Initialize Database

After first deployment, initialize database:

```bash
# Run migrations
npm run db:push

# Or manually:
psql <DATABASE_URL> -f path/to/migrations/file.sql
```

Railway can run initialization scripts in `./scripts/init.sh` automatically.

## Step 6: First-Time Setup

1. Access application at https://postiusgroup.com
2. Register a new user account
3. Navigate to Settings page
4. Enter your GitHub Personal Access Token
5. Click "Sync Now" to perform first sync
6. Confirm repositories appear on dashboard

## Monitoring and Logs

### View Railway Logs

```bash
railway logs
```

### Common Issues

**502 Bad Gateway**
- Check if application is running: `railway logs`
- Verify DATABASE_URL is correct
- Check for port binding errors

**Database Connection Error**
- Verify DATABASE_URL format
- Check PostgreSQL is accepting connections
- Ensure Firewall rules allow Railway IPs

**GitHub API Errors**
- Verify GITHUB_TOKEN is valid
- Check GitHub API rate limits: https://api.github.com/rate_limit
- Ensure token has required permissions (repo, read:user)

**Sync Not Running**
- Check background jobs initialization in logs
- Verify SYNC_INTERVAL_MINUTES is set
- Check database connectivity

## Production Considerations

1. **Security**
   - Use strong SESSION_SECRET (32+ characters)
   - Enable HTTPS (Cloudflare + Railway)
   - Keep GitHub token secure (never commit to repo)
   - Consider rotating token periodically

2. **Performance**
   - Enable database connection pooling (Railway PostgreSQL default)
   - Set appropriate SYNC_INTERVAL_MINUTES
   - Monitor CPU/memory usage in Railway dashboard
   - Consider caching strategies for GitHub API

3. **Reliability**
   - Set up monitoring/alerts in Railway dashboard
   - Enable auto-restart on failure
   - Keep backups of database
   - Monitor background job logs

4. **Scaling**
   - Increase Railway instance size if needed
   - Consider read replicas for database
   - Implement request rate limiting for API
   - Cache frequently accessed data

## Rollback Procedure

```bash
# Revert to previous commit
git revert <commit-hash>

# Or use Railway dashboard to redeploy specific commit
# Railway > Project > Deployments > Select previous > Redeploy
```

## Troubleshooting Deployment

### Build Failure

Check build logs in Railway dashboard:
- Ensure all dependencies in package.json
- Verify TypeScript compilation
- Check for missing environment variables during build

### Runtime Errors

```bash
# SSH into Railway container
railway shell

# Check Node version
node --version

# Check if port is listening
netstat -tlnp | grep 8000

# View detailed logs
tail -f logs.txt
```

### Database Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check table creation
psql $DATABASE_URL -c "\dt"
```

## Health Check Endpoint

Add health check in Railway settings:
- **Path**: `/api/health` (if implemented)
- **Method**: GET
- **Timeout**: 30s

## Scheduled Maintenance

- Update dependencies monthly: `npm outdated`
- Review GitHub token scope and rotate if needed
- Clean up old logs and database backups
- Monitor Railway usage for cost optimization

## Support

For issues:
- Railway support: https://railway.app/support
- GitHub Dashboard issues: Check logs and README.md
- Database issues: Neon or PostgreSQL documentation
