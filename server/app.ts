import express, { type Express } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { passport } from "./auth";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build the Express application. Kept separate from index.ts (which owns the
 * HTTP listener and background jobs) so tests can exercise the app in-process
 * with supertest without binding a port or starting cron jobs.
 *
 * @param pool Postgres pool used for the session store and the health check.
 */
export async function createApp(pool: Pool): Promise<Express> {
  const NODE_ENV = process.env.NODE_ENV || "development";
  const app = express();

  // Trust the TLS-terminating proxy (Railway / Cloudflare) so that secure
  // session cookies are issued for requests that arrived over HTTPS but reach
  // the app as plain HTTP. Without this, login silently fails in production.
  if (NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  const PgSession = ConnectPgSimple(session);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-key-min-32-characters",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );

  // Passport auth
  app.use(passport.initialize());
  app.use(passport.session());

  // Health check (no auth) — verifies the process is up and the database is
  // reachable. Used by container/orchestrator health checks.
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected", uptime: process.uptime() });
    } catch (err) {
      res.status(503).json({ status: "error", database: "unreachable" });
    }
  });

  // API Routes
  registerRoutes(app);

  // Unknown API routes must return JSON 404, not fall through to the SPA HTML
  // fallback (or the Vite dev server) below.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Serve static files in production
  if (NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "../dist/public")));

    // Fallback to index.html for SPA routing
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "../dist/public/index.html"));
    });
  }

  // Development: Vite dev server integration
  if (NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app);
  }

  // Error handling
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
