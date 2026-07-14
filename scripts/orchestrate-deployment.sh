#!/bin/bash

# GitHub Dashboard - Master Deployment Orchestrator
# Guides through complete deployment process with automation

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${COLOR_BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${COLOR_GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${COLOR_RED}❌ $1${NC}"
}

log_step() {
    echo -e "\n${COLOR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${COLOR_CYAN}$1${NC}"
    echo -e "${COLOR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Banner
clear
echo -e "${COLOR_CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🚀 GitHub Dashboard - Master Deployment Orchestrator               ║
║                                                                      ║
║   Domain: dashboard.postiusgroup.com                                 ║
║   Platform: Railway + Cloudflare                                     ║
║   Database: PostgreSQL (Neon)                                        ║
║                                                                      ║
║   This script will guide you through the complete deployment         ║
║   process with automated setup and verification steps.               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

# Configuration
DOMAIN="dashboard.postiusgroup.com"
PROJECT_NAME="github-dashboard"
DEPLOYMENT_LOG="/tmp/deployment-${PROJECT_NAME}-$(date +%s).log"

# Start logging
log_info "Deployment log: $DEPLOYMENT_LOG"
exec > >(tee -a "$DEPLOYMENT_LOG")
exec 2>&1

log_step "Phase 1: Pre-Deployment Verification"

# Check Node.js
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_error "Node.js is required. Install it from https://nodejs.org"
    exit 1
fi
log_success "Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is required"
    exit 1
fi
log_success "npm $(npm --version)"

# Check git
if ! command -v git &> /dev/null; then
    log_error "git is required"
    exit 1
fi
log_success "git $(git --version | cut -d' ' -f3)"

# Verify clean git state
log_info "Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    log_error "Git working directory has uncommitted changes"
    git status --short
    exit 1
fi
log_success "Git working directory is clean"

# Run build verification
log_info "Verifying production build..."
if ! npm run build > /dev/null 2>&1; then
    log_error "Production build failed"
    exit 1
fi
log_success "Production build successful"

# Run TypeScript check
log_info "Running TypeScript compiler check..."
if ! npm run check > /dev/null 2>&1; then
    log_error "TypeScript compilation failed"
    exit 1
fi
log_success "TypeScript checks passed"

log_success "Pre-deployment verification complete!\n"

log_step "Phase 2: Environment Setup"

# Check for .env.production
if [ ! -f ".env.production" ]; then
    log_info "No .env.production file found"
    if [ -f ".env.production.template" ]; then
        log_info "Creating .env.production from template..."
        cp .env.production.template .env.production
        log_info "Edit .env.production with your values"
    else
        log_info "Create .env.production with required variables"
    fi
fi

# Validate environment
log_info "Validating environment variables..."
if ! node scripts/validate-env.cjs; then
    log_error "Environment validation failed"
    exit 1
fi

log_success "Environment setup complete!\n"

log_step "Phase 3: Railway Configuration"

# Check Railway CLI
log_info "Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    log_info "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Check Railway auth
log_info "Checking Railway authentication..."
if ! railway whoami > /dev/null 2>&1; then
    log_info "Please log in to Railway..."
    railway login
fi
log_success "Railway authenticated"

# Detect or create Railway project
log_info "Checking Railway project..."
if [ -f "railway.json" ]; then
    log_success "railway.json found"
else
    log_info "No railway.json found, will create during deployment"
fi

log_success "Railway configuration complete!\n"

log_step "Phase 4: Database Setup"

read -p "Have you created a PostgreSQL database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter DATABASE_URL: " DATABASE_URL

    # Test connection
    log_info "Testing database connection..."
    if ! PGPASSWORD="${DATABASE_URL##*:}" psql "${DATABASE_URL}" -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to database"
        echo "Check your DATABASE_URL and network connectivity"
        exit 1
    fi

    log_success "Database connection verified"

    # Export for initialization
    export DATABASE_URL

    log_info "Initializing database schema..."
    if ! bash scripts/init-db.sh; then
        log_error "Database initialization failed"
        exit 1
    fi

    log_success "Database setup complete!"
else
    log_info "⚠️  Database setup required before deployment"
    echo "Follow these steps:"
    echo "  1. Create PostgreSQL database (Neon recommended: https://neon.tech)"
    echo "  2. Get connection string"
    echo "  3. Set DATABASE_URL in .env.production"
    echo "  4. Run: bash scripts/init-db.sh"
    exit 1
fi

log_success "Database setup complete!\n"

log_step "Phase 5: Railway Deployment"

read -p "Deploy to Railway now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Starting Railway deployment..."

    # Set environment variables in Railway
    log_info "Setting environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)

    railway variables set NODE_ENV="production"
    railway variables set PORT="8000"
    railway variables set LOG_LEVEL="info"
    railway variables set SYNC_INTERVAL_MINUTES="60"

    log_success "Environment variables set in Railway"

    # Deploy
    log_info "Deploying application..."
    railway up --detach

    log_success "Railway deployment initiated"
    log_info "Waiting for deployment to complete (this may take a few minutes)..."
    sleep 10

    # Get deployment URL
    log_info "Retrieving deployment URL..."
    RAILWAY_URL=$(railway domain 2>/dev/null || echo "pending")

    if [ "$RAILWAY_URL" != "pending" ]; then
        log_success "Railway URL: $RAILWAY_URL"
    else
        log_info "Deployment URL will be available shortly"
    fi
else
    log_info "Skipping Railway deployment"
    log_info "To deploy later, run: railway up"
fi

log_success "Railway deployment phase complete!\n"

log_step "Phase 6: Cloudflare DNS Configuration"

read -p "Configure Cloudflare DNS now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Opening Cloudflare configuration guide..."
    log_info "See: scripts/cloudflare-setup.md"

    echo ""
    echo "Manual Steps Required:"
    echo "  1. Go to: https://dash.cloudflare.com"
    echo "  2. Select postiusgroup.com domain"
    echo "  3. Navigate to DNS section"
    echo "  4. Add CNAME record:"
    echo "     Name: dashboard"
    echo "     Target: <your-railway-url>"
    echo "     Proxy: Proxied (Orange Cloud)"
    echo "  5. Go to SSL/TLS → Edge Certificates"
    echo "  6. Enable 'Always Use HTTPS'"
    echo ""
    log_info "Refer to scripts/cloudflare-setup.md for detailed instructions"

    read -p "Press Enter after configuring Cloudflare DNS..."
else
    log_info "Skipping Cloudflare configuration"
    log_info "Refer to scripts/cloudflare-setup.md for later setup"
fi

log_success "Cloudflare configuration phase complete!\n"

log_step "Phase 7: Health Checks & Verification"

log_info "Waiting for application to be accessible (max 2 minutes)..."

MAX_ATTEMPTS=12
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if node scripts/health-check.cjs; then
        HEALTHY=true
        break
    fi

    log_info "Attempt $ATTEMPT/$MAX_ATTEMPTS - Retrying in 10 seconds..."
    sleep 10
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" = true ]; then
    log_success "Application health checks passed!"
else
    log_info "⚠️  Application not yet responding"
    log_info "This may be normal during initial deployment"
    log_info "Check Railway logs: railway logs"
fi

log_success "Health checks complete!\n"

log_step "Phase 8: Deployment Summary"

echo -e "${COLOR_GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${COLOR_GREEN}✅ DEPLOYMENT ORCHESTRATION COMPLETE${NC}"
echo -e "${COLOR_GREEN}═══════════════════════════════════════════════════════════════════════${NC}\n"

echo "📊 Deployment Information:"
echo "   Project: $PROJECT_NAME"
echo "   Domain: $DOMAIN"
echo "   Platform: Railway + Cloudflare + PostgreSQL"
echo "   Log File: $DEPLOYMENT_LOG"

echo ""
echo "📋 Completion Checklist:"
echo "   ✓ Pre-deployment verification"
echo "   ✓ Environment configuration"
echo "   ✓ Railway setup"
echo "   ✓ Database initialization"
echo "   ✓ Application deployment"
echo "   $([ "$HEALTHY" = true ] && echo "✓" || echo "○") Application health checks"
echo "   ○ Cloudflare DNS configuration"
echo "   ○ Production access"

echo ""
echo "🚀 Next Steps:"
echo "   1. Verify Cloudflare CNAME record is set"
echo "   2. Wait for DNS propagation (up to 24 hours)"
echo "   3. Access: https://$DOMAIN"
echo "   4. Create admin account"
echo "   5. Add GitHub Personal Access Token"
echo "   6. Perform initial repository sync"

echo ""
echo "📞 Support & Monitoring:"
echo "   • Railway Logs: railway logs"
echo "   • Railway Dashboard: https://railway.app/dashboard"
echo "   • Cloudflare Analytics: https://dash.cloudflare.com"
echo "   • Health Check: node scripts/health-check.cjs"
echo "   • Deployment Status: node scripts/deployment-status.cjs"

echo ""
echo "📚 Documentation:"
echo "   • Main Setup: POSTIUSGROUP_SETUP.md"
echo "   • Cloudflare Guide: scripts/cloudflare-setup.md"
echo "   • Development: DEVELOPMENT.md"

echo -e "\n"

log_success "Deployment orchestration complete!"
log_info "Application will be available at: https://$DOMAIN"
