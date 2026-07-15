# GitHub Repository Dashboard

> A modern, full-stack dashboard to monitor all your GitHub repositories—track dependencies, detect security vulnerabilities, visualize system architecture, and aggregate error logs—all in one place.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-brightgreen)

## 🎯 Features

### Dashboard Overview
- **Unified Repository View**: See all your GitHub repos at a glance with real-time status indicators
- **Quick Stats**: Vulnerability counts, outdated packages, repository health at a glance
- **Filtered Search**: Filter by language, status, or search by name

### Dependency Management
- **Outdated Package Detection**: Know which dependencies need updates
- **Vulnerability Scanning**: Integrated GitHub Dependabot for security alerts (CVE/GHSA tracking)
- **Unused Dependency Detection**: Identify and clean up unused packages via knip
- **Version Comparison**: See current vs. latest versions for all dependencies

### Architecture Visualization
- **Auto-Generated Dependency Graphs**: Mermaid diagrams of your codebase structure
- **Module Browser**: Interactive file tree showing module relationships
- **Entry Point Identification**: Understand your application's architecture at a glance
- **Circular Dependency Detection**: Find and fix architectural issues

### Log & Error Tracking
- **Build Logs**: Track sync and analysis logs per repository
- **Error History**: See which repositories have recent issues
- **Searchable Logs**: Find specific errors across all projects

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL 12+ (or use Neon for free)
- GitHub Personal Access Token

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/nilpost/github-dashboard.git
cd github-dashboard
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your GitHub token and database URL

# 3. Set up database
npm run db:push

# 4. Start development server
npm run dev
```

Access the app at `http://localhost:5000`

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions to deploy on Railway with Cloudflare DNS.

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Project context, architecture map, conventions & gotchas (also auto-loaded by Claude Code)
- **[DEPLOY.md](DEPLOY.md)** - Concise deployment runbook (start here to go live)
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Local setup, development workflow, troubleshooting
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Railway deployment, Cloudflare DNS configuration
- **[POSTIUSGROUP_SETUP.md](POSTIUSGROUP_SETUP.md)** - Full postiusgroup.com production setup guide
- **[DEPLOYMENT_AUTOMATION.md](DEPLOYMENT_AUTOMATION.md)** - Deployment automation scripts reference
- **[TOOLS_INTEGRATION_STRATEGY.md](TOOLS_INTEGRATION_STRATEGY.md)** - External tools rationale, API examples, implementation guide

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (fast build tooling)
- Tailwind CSS + shadcn/ui
- Wouter (lightweight routing)
- TanStack Query (data fetching)
- Mermaid.js (diagrams)
- Recharts (charts)

**Backend**
- Express.js + Node.js
- Passport.js (authentication)
- Drizzle ORM (type-safe database)
- node-cron (background jobs)
- Octokit (GitHub API)

**Infrastructure**
- PostgreSQL (Neon recommended)
- Railway (hosting)
- Cloudflare (DNS + CDN)

**External Analysis Tools**
- GitHub Dependabot (vulnerability scanning)
- dependency-cruiser (architecture analysis)
- npm-check-updates (version checking)
- knip (unused dependency detection)

### Project Structure

```
.
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/          # Route components
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities (API, query client)
│   │   └── index.tsx       # Entry point
│   └── index.html
├── server/                  # Express backend
│   ├── services/           # GitHub, dependency, vulnerability services
│   ├── jobs/               # Background cron jobs
│   ├── routes.ts           # API endpoints
│   ├── auth.ts             # Passport.js setup
│   ├── db.ts               # Database connection
│   ├── storage.ts          # Data access layer
│   └── index.ts            # Server entry
├── shared/                  # Shared code
│   └── schema.ts           # Drizzle ORM schema + Zod validation
├── migrations/             # Database migrations
└── docs/                   # Additional documentation
```

## 🔄 Implementation Phases

### Phase 1: MVP ✅ COMPLETE
- Dashboard overview with repository grid
- Dependency listing and analysis
- Settings for GitHub token management
- Background sync jobs
- Database schema and API endpoints

### Phase 2: Vulnerability Detection 🚀 IN PROGRESS
- GitHub Dependabot integration for security alerts
- Vulnerability tracking with severity filtering
- Unused dependency detection via knip
- Manual and automatic vulnerability scanning

### Phase 3: Architecture Visualization 📋 PLANNED
- dependency-cruiser integration for code analysis
- Interactive Mermaid diagrams
- Module structure visualization
- Circular dependency detection

### Phase 4: Polish & Production 🎨 PLANNED
- WebSocket real-time updates
- Email notifications
- Performance optimization
- Comprehensive test suite
- Security hardening

## 🛠️ Development

### Running Tests
```bash
npm run check    # TypeScript type checking
npm run build    # Production build
npm run dev      # Development server with HMR
```

### Database Migrations
```bash
npm run db:push  # Apply schema changes
npm run db:drop  # Drop all tables (dev only)
```

### Code Style
- TypeScript for type safety
- ESLint for linting (configured)
- Prettier for formatting
- Tailwind CSS for styling

## 🔐 Security

- GitHub tokens stored in environment variables (never committed)
- Session-based authentication with secure cookies
- Password hashing with scrypt
- Input validation with Zod schemas
- HTTPS enforced in production (via Cloudflare)
- SQL injection prevention via Drizzle ORM

## 📊 Why External Tools?

This project leverages **battle-tested open-source tools** instead of building custom analysis engines:

| Tool | Purpose | Rationale |
|------|---------|-----------|
| **GitHub Dependabot** | Vulnerability scanning | Built-in, zero setup, auto-fixes |
| **dependency-cruiser** | Architecture analysis | 6.9k⭐, Mermaid output, validation rules |
| **npm-check-updates** | Version checking | Industry standard, all package managers |
| **knip** | Unused dependency detection | 11.7k⭐, replaces archived depcheck |

**Result**: 6+ weeks saved in development time while improving quality with community-tested tools.

See [TOOLS_INTEGRATION_STRATEGY.md](TOOLS_INTEGRATION_STRATEGY.md) for detailed comparison.

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt it for your own use case!

## 📝 License

MIT License - see LICENSE file for details

## 🚀 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Email digest notifications
- [ ] Batch remediation (create fix PRs)
- [ ] Team/organization support
- [ ] Custom vulnerability thresholds
- [ ] Trend analysis (vulnerability count over time)
- [ ] Report generation (PDF/HTML)
- [ ] GitHub Actions integration
- [ ] Slack bot integration

## 💬 Questions?

Check the [DEVELOPMENT.md](DEVELOPMENT.md) guide for local setup help, or see [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment questions.

---

Built with ❤️ using Claude Code
