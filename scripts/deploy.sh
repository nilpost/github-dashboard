#!/bin/bash

# GitHub Dashboard - Railway Deployment Automation Script
# This script automates the deployment process to Railway + Cloudflare

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="github-dashboard"
DOMAIN="dashboard.postiusgroup.com"
RAILWAY_API_URL="https://api.railway.app"

# Log functions
log_info() {
    echo -e "${COLOR_BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${COLOR_GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${COLOR_RED}❌ $1${NC}"
}

# Header
echo -e "${COLOR_BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║   GitHub Dashboard - Railway Deployment Automation             ║
║   Domain: dashboard.postiusgroup.com                           ║
║   Environment: Production                                      ║
╚════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js first."
    exit 1
fi
log_success "Node.js found: $(node --version)"

if ! command -v npm &> /dev/null; then
    log_error "npm not found. Please install npm first."
    exit 1
fi
log_success "npm found: $(npm --version)"

# Step 2: Check if Railway CLI is installed
log_info "Step 2: Checking Railway CLI..."

if ! command -v railway &> /dev/null; then
    log_warning "Railway CLI not found. Installing..."
    npm install -g @railway/cli
    log_success "Railway CLI installed"
else
    log_success "Railway CLI found: $(railway --version)"
fi

# Step 3: Verify git state
log_info "Step 3: Verifying git state..."

if [ -n "$(git status --porcelain)" ]; then
    log_error "Working directory has uncommitted changes. Please commit or stash first."
    git status
    exit 1
fi
log_success "Git working directory is clean"

GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Current commit: $GIT_COMMIT"
log_info "Current branch: $GIT_BRANCH"

# Step 4: Build verification
log_info "Step 4: Verifying production build..."

if ! npm run build &> /dev/null; then
    log_error "Production build failed. Check the build output above."
    exit 1
fi
log_success "Production build successful"

# Step 5: Verify environment
log_info "Step 5: Checking environment setup..."

if [ ! -f ".env.production" ] && [ -z "$RAILWAY_TOKEN" ]; then
    log_warning "No .env.production file and RAILWAY_TOKEN not set"
    log_info "You'll need to login to Railway in the next step"
fi

# Step 6: Railway login check
log_info "Step 6: Verifying Railway authentication..."

if ! railway login --help &> /dev/null; then
    log_error "Railway login failed"
    exit 1
fi

if ! railway whoami &> /dev/null; then
    log_warning "Not logged into Railway. Please log in..."
    railway login
else
    log_success "Railway authentication verified"
fi

# Step 7: Generate environment variables
log_info "Step 7: Generating environment variables..."

SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
log_success "Generated SESSION_SECRET"

# Step 8: Create deployment plan
log_info "Step 8: Creating deployment plan..."

cat > /tmp/deployment-plan.txt << EOF
═══════════════════════════════════════════════════════════════
DEPLOYMENT PLAN FOR: $PROJECT_NAME
═══════════════════════════════════════════════════════════════

1. RAILWAY SETUP
   └─ Create or link Railway project
   └─ Configure environment variables
   └─ Deploy application
   └─ Verify deployment health

2. CLOUDFLARE DNS
   └─ Add CNAME record
   └─ Configure SSL/TLS
   └─ Enable HTTPS redirect
   └─ Update nameservers (if needed)

3. DATABASE INITIALIZATION
   └─ Create PostgreSQL database (Neon)
   └─ Run migrations
   └─ Verify schema

4. APPLICATION SETUP
   └─ Access https://$DOMAIN
   └─ Create admin account
   └─ Configure GitHub token
   └─ Perform initial sync

5. MONITORING & VERIFICATION
   └─ Check application health
   └─ Verify API endpoints
   └─ Monitor logs
   └─ Test full workflow

═══════════════════════════════════════════════════════════════
GENERATED SECRETS:
═══════════════════════════════════════════════════════════════
SESSION_SECRET: $SESSION_SECRET
(Keep this secure and store in Railway)

═══════════════════════════════════════════════════════════════
NEXT STEPS:
═══════════════════════════════════════════════════════════════

1. Create/Link Railway Project:
   railway link

2. Set Environment Variables in Railway:
   railway variables set SESSION_SECRET="$SESSION_SECRET"
   railway variables set DATABASE_URL="postgresql://user:password@host/db"
   railway variables set GITHUB_TOKEN="ghp_xxxxx"
   railway variables set NODE_ENV="production"
   railway variables set PORT="8000"

3. Deploy:
   railway up

4. Configure Cloudflare:
   - Add CNAME: dashboard.postiusgroup.com → <railway-url>
   - Enable SSL/TLS in Full mode
   - Enable Always Use HTTPS

5. Initialize Database:
   railway shell
   npm run db:push

6. Access Application:
   https://dashboard.postiusgroup.com

═══════════════════════════════════════════════════════════════
EOF

cat /tmp/deployment-plan.txt
log_success "Deployment plan created"

# Step 9: Create environment template
log_info "Step 9: Creating environment template..."

cat > .env.production.template << EOF
# GitHub Dashboard - Production Environment
# Copy this to .env.production and fill in your values

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/github_dashboard

# Session Security
SESSION_SECRET=$SESSION_SECRET

# GitHub API
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Application
NODE_ENV=production
PORT=8000

# Background Jobs
SYNC_INTERVAL_MINUTES=60

# Logging
LOG_LEVEL=info
EOF

log_success "Environment template created: .env.production.template"

# Step 10: Create verification checklist
log_info "Step 10: Creating verification checklist..."

cat > /tmp/deployment-checklist.md << 'EOF'
# Deployment Verification Checklist

## Pre-Deployment ✓
- [ ] Git working directory is clean
- [ ] Production build passes
- [ ] All TypeScript checks pass (npm run check)
- [ ] All dependencies installed

## Railway Setup
- [ ] Railway CLI authenticated
- [ ] Railway project created or linked
- [ ] Environment variables set:
  - [ ] DATABASE_URL
  - [ ] SESSION_SECRET
  - [ ] GITHUB_TOKEN
  - [ ] NODE_ENV=production
  - [ ] PORT=8000

## Database Setup
- [ ] PostgreSQL database created (Neon recommended)
- [ ] Database connection verified
- [ ] Migrations applied (npm run db:push)
- [ ] Schema verified

## Cloudflare Configuration
- [ ] CNAME record added: dashboard.postiusgroup.com
- [ ] SSL/TLS set to "Full"
- [ ] "Always Use HTTPS" enabled
- [ ] HTTP redirect rule created (optional)

## Application Verification
- [ ] Application deployed to Railway
- [ ] HTTPS access works: https://dashboard.postiusgroup.com
- [ ] HTTP redirects to HTTPS
- [ ] Login page loads
- [ ] Can register new user
- [ ] Can log in with credentials
- [ ] Dashboard displays
- [ ] Settings page accessible
- [ ] GitHub token validation works

## Health Checks
- [ ] API health endpoint responds
- [ ] Database connection stable
- [ ] No 502/503 errors in logs
- [ ] Response times <500ms
- [ ] No memory leaks detected

## Security Verification
- [ ] HTTPS certificate valid
- [ ] Session cookies secure (httpOnly, sameSite)
- [ ] No sensitive data in logs
- [ ] GitHub token not exposed
- [ ] Database passwords not logged

## Monitoring Setup
- [ ] Railway metrics dashboard accessible
- [ ] Log streaming configured
- [ ] Health check endpoint configured
- [ ] Alerts configured (optional)

## Post-Deployment
- [ ] Full sync cycle completed
- [ ] Repositories appear on dashboard
- [ ] Vulnerability detection working
- [ ] Dependency analysis working

---
**Deployment Status**: Ready for Launch ✨
**Domain**: dashboard.postiusgroup.com
**Last Updated**: 2026-07-14
EOF

cat /tmp/deployment-checklist.md
log_success "Deployment checklist created"

# Step 11: Summary
log_info "Step 11: Deployment preparation complete!"

echo -e "\n${COLOR_GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${COLOR_GREEN}✅ DEPLOYMENT AUTOMATION READY${NC}"
echo -e "${COLOR_GREEN}═══════════════════════════════════════════════════════════${NC}\n"

echo "📋 Generated Files:"
echo "   • .env.production.template - Environment template"
echo "   • /tmp/deployment-plan.txt - Detailed deployment plan"
echo "   • /tmp/deployment-checklist.md - Verification checklist"

echo -e "\n🚀 Next Steps:"
echo "   1. Review the deployment plan in: /tmp/deployment-plan.txt"
echo "   2. Copy and fill .env.production.template"
echo "   3. Create Railway project: railway link"
echo "   4. Set environment variables: railway variables set ..."
echo "   5. Deploy: railway up"
echo "   6. Configure Cloudflare DNS (see plan)"

echo -e "\n💡 Tips:"
echo "   • Save SESSION_SECRET in a secure location"
echo "   • Use Neon for PostgreSQL (free tier available)"
echo "   • Test GitHub token before deploying"
echo "   • Start with staging before production"

echo -e "\n📖 Reference:"
echo "   • Deployment Guide: POSTIUSGROUP_SETUP.md"
echo "   • Development Guide: DEVELOPMENT.md"

echo -e "\n"
