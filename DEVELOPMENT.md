# Development Guide

This guide helps you set up the GitHub Dashboard for local development.

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 12+ (or PostgreSQL Docker container)
- Git

## Local Setup

### 1. Clone and Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Set Up Local PostgreSQL

#### Option A: Using Docker

```bash
# Create PostgreSQL container
docker run --name github-dashboard-db \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=github_dashboard \
  -p 5432:5432 \
  postgres:15-alpine

# In another terminal, verify connection
psql -h localhost -U postgres -d github_dashboard
```

#### Option B: Using Local PostgreSQL

```bash
# Create database
createdb github_dashboard

# Or using psql
psql
postgres=# CREATE DATABASE github_dashboard;
```

### 3. Create .env File

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/github_dashboard
SESSION_SECRET=dev-secret-key-min-32-characters-long
GITHUB_TOKEN=ghp_your_personal_access_token_here
SYNC_INTERVAL_MINUTES=60
NODE_ENV=development
PORT=5000
```

### 4. Run Database Migrations

```bash
npm run db:push
```

This creates tables automatically using Drizzle ORM.

## Development Workflow

### Start Development Server

```bash
npm run dev
```

This runs:
- Vite dev server for frontend (HMR enabled)
- Express server for backend
- TypeScript compilation in watch mode

Access at http://localhost:5000

### Run Type Checking

```bash
npm run check
```

### Build for Production

```bash
npm run build
```

Creates optimized bundle in `dist/` directory.

### Production Build Test

```bash
npm run build
npm run start
```

## Project Structure

```
dashboard/
├── client/
│   ├── src/
│   │   ├── App.tsx                 # Main router
│   │   ├── pages/                  # Route pages
│   │   │   ├── dashboard-page.tsx
│   │   │   ├── repository-page.tsx
│   │   │   ├── settings-page.tsx
│   │   │   ├── profile-page.tsx
│   │   │   └── login-page.tsx
│   │   ├── hooks/
│   │   │   └── use-auth.tsx        # Auth hook
│   │   ├── lib/
│   │   │   └── queryClient.ts      # TanStack Query setup
│   │   ├── components/ui/          # UI components
│   │   ├── index.tsx               # React entry
│   │   └── index.css
│   ├── index.html
│   └── ...
├── server/
│   ├── services/
│   │   ├── github.service.ts       # GitHub API integration
│   │   ├── dependency.service.ts   # Dependency analysis
│   │   ├── sync.service.ts         # Sync orchestration
│   │   └── vulnerability.service.ts # (Phase 2)
│   ├── jobs/
│   │   ├── sync-repositories.job.ts # Background sync
│   │   ├── detect-vulnerabilities.job.ts
│   │   └── index.ts
│   ├── index.ts                    # Server entry
│   ├── routes.ts                   # API routes
│   ├── auth.ts                     # Passport.js setup
│   ├── db.ts                       # Database connection
│   ├── storage.ts                  # Data access layer
│   └── vite.ts                     # Vite dev server
├── shared/
│   └── schema.ts                   # Database schema + types
├── migrations/                     # Drizzle migrations
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── drizzle.config.ts
```

## Making Changes

### Adding a New API Endpoint

1. Add function to relevant service in `server/services/`
2. Add route in `server/routes.ts`:

```typescript
router.get("/api/your-endpoint", requireAuth, async (req, res) => {
  try {
    const result = await someService.doSomething();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to do something" });
  }
});
```

3. Add Zod schema to `shared/schema.ts` if needed
4. Test with curl or Thunder Client

### Adding a New Page

1. Create `client/src/pages/new-page.tsx`
2. Add route in `client/src/App.tsx`:

```typescript
<Route path="/new-path" component={() => <ProtectedRoute component={NewPage} />} />
```

3. Use existing hooks (useAuth) and components
4. Style with Tailwind CSS classes

### Modifying Database Schema

1. Edit `shared/schema.ts` (add/modify table definitions)
2. Generate migration:

```bash
npm run db:push
```

3. Review generated migration file in `migrations/`
4. Schema changes auto-apply on server restart

## Testing

### Manual Testing Checklist

- [ ] Login/Register flow works
- [ ] Dashboard loads with repos
- [ ] Click repo to view details
- [ ] Settings page saves without error
- [ ] Manual sync triggers
- [ ] Dependencies list loads
- [ ] Logout works

### API Testing

Using curl:

```bash
# Register
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'

# Fetch repos (requires valid session cookie)
curl http://localhost:5000/api/repositories \
  -b "connect.sid=..."
```

### Database Inspection

```bash
psql $DATABASE_URL

# List tables
\dt

# View users
SELECT * FROM users;

# View repositories for user
SELECT * FROM repositories WHERE user_id = 1;

# View dependencies
SELECT * FROM dependencies LIMIT 10;
```

## Common Development Tasks

### Clear All Data

```bash
# WARNING: This deletes everything
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then re-run migrations
npm run db:push
```

### Seed Test Data

```typescript
// server/seed.ts
import * as storage from "./storage";

export async function seedTestData() {
  const user = await storage.createUser({
    username: "testuser",
    email: "test@example.com",
    password: hashPassword("password123"),
  });
  
  console.log("Seeded test data:", user);
}
```

Then run: `node dist/seed.js`

### Debug Background Jobs

Edit `server/jobs/sync-repositories.job.ts` and add logging:

```typescript
console.log("Job running at", new Date());
```

Watch logs: `npm run dev 2>&1 | grep "Job running"`

### Monitor API Requests

Add to `server/index.ts`:

```typescript
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

## Environment Variables

**Development:**
```env
NODE_ENV=development
GITHUB_TOKEN=ghp_...
DATABASE_URL=postgresql://...
SESSION_SECRET=dev-secret
SYNC_INTERVAL_MINUTES=60
```

**Production:**
```env
NODE_ENV=production
GITHUB_TOKEN=ghp_... (use strong token)
DATABASE_URL=postgresql://... (use production DB)
SESSION_SECRET=<random-32-chars>
SYNC_INTERVAL_MINUTES=60
```

## Performance Optimization

### Frontend
- Use React DevTools profiler to identify slow components
- Check bundle size: `npm run build && npm run analyze`
- Lazy load pages with React.lazy()

### Backend
- Index frequently queried columns in database
- Use database connection pooling
- Add caching for GitHub API responses
- Monitor slow queries in logs

### Database
```sql
-- Add indexes
CREATE INDEX idx_repo_user_id ON repositories(user_id);
CREATE INDEX idx_dependency_repo_id ON dependencies(repository_id);
CREATE INDEX idx_vuln_repo_id ON vulnerabilities(repository_id);
```

## Troubleshooting

### "Cannot find module @octokit/rest"

```bash
npm install
```

### Database Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or locally
psql postgres -c "SELECT 1"
```

### Vite HMR Not Working

Restart dev server:
```bash
npm run dev
```

### Port Already in Use

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test locally

# Commit
git commit -am "Add my feature"

# Push to branch
git push origin feature/my-feature

# Create pull request for review
```

## Resources

- [React Documentation](https://react.dev)
- [Drizzle ORM Guide](https://orm.drizzle.team)
- [Express.js Guide](https://expressjs.com)
- [Tailwind CSS](https://tailwindcss.com)
- [GitHub API](https://docs.github.com/en/rest)

## Getting Help

1. Check existing code for examples
2. Review error messages carefully
3. Check Docker logs: `docker logs github-dashboard-db`
4. Check server logs: watch `npm run dev` output
5. Check browser console: F12 in browser

Happy coding! 🚀
