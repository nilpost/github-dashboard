#!/bin/bash

# Database Initialization Script
# Initializes PostgreSQL database and runs migrations

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
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

# Header
echo -e "${COLOR_BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║   GitHub Dashboard - Database Initialization               ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL environment variable not set"
    echo "Set it with: export DATABASE_URL='postgresql://user:pass@host/db'"
    exit 1
fi

log_info "Database URL: ${DATABASE_URL:0:50}..."

# Step 1: Validate connection
log_info "Step 1: Validating database connection..."

if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Cannot connect to database"
    echo "   Check your DATABASE_URL and network connectivity"
    exit 1
fi

log_success "Database connection successful"

# Step 2: Get database info
log_info "Step 2: Retrieving database information..."

DB_INFO=$(psql "$DATABASE_URL" -t -c "
    SELECT datname, version()
    FROM pg_database
    WHERE datname = current_database()
" | head -1)

log_success "Connected to database"
echo "   Info: $DB_INFO"

# Step 3: Check existing tables
log_info "Step 3: Checking existing schema..."

TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
" | tr -d ' ')

if [ "$TABLE_COUNT" -gt 0 ]; then
    log_info "Found $TABLE_COUNT existing tables"
    echo ""
    echo "Existing tables:"
    psql "$DATABASE_URL" -t -c "
        SELECT '  • ' || tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    "
    echo ""
    read -p "Drop existing schema and reinitialize? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Dropping existing schema..."
        psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        log_success "Schema dropped and recreated"
    else
        log_info "Keeping existing schema"
    fi
else
    log_success "Database is empty"
fi

# Step 4: Run migrations
log_info "Step 4: Running database migrations..."

if [ ! -f "drizzle.config.ts" ]; then
    log_error "drizzle.config.ts not found"
    echo "   Make sure you're in the project root directory"
    exit 1
fi

npm run db:push
log_success "Migrations completed successfully"

# Step 5: Verify schema
log_info "Step 5: Verifying schema creation..."

TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
" | tr -d ' ')

echo "Tables created: $TABLE_COUNT"
echo ""
echo "Table list:"
psql "$DATABASE_URL" -t -c "
    SELECT '  • ' || tablename || ' (' ||
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = tablename) || ' columns)'
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
"

# Step 6: Create default data (optional)
log_info "Step 6: Database initialization summary..."

echo ""
echo "Database Status:"
echo "  ✓ Connection verified"
echo "  ✓ Schema initialized"
echo "  ✓ Migrations applied"
echo "  ✓ $TABLE_COUNT tables created"

echo ""
log_success "Database initialization complete!"

echo ""
echo "Next steps:"
echo "  1. Deploy application to Railway"
echo "  2. Set DATABASE_URL environment variable"
echo "  3. Application will connect and verify schema on startup"
echo ""
