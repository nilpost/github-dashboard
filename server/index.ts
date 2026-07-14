import express from "express";
import { createServer } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { passport } from "./auth";
import { registerRoutes } from "./routes";
import { closeDb } from "./db";
import { initializeAllJobs } from "./jobs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const app = express();

// Session store
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const PgSession = ConnectPgSimple(session);

// Middleware
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

// API Routes
registerRoutes(app);

// Serve static files in production
if (NODE_ENV === "production") {
  app.use(express.static(path.resolve(__dirname, "../dist/public")));

  // Fallback to index.html for SPA routing
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../dist/public/index.html"));
  });
}

// Development: Vite dev server integration
if (NODE_ENV === "development") {
  const { setupVite } = await import("./vite");
  await setupVite(app);
}

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Create and start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);

  // Initialize background jobs after server starts
  initializeAllJobs().catch((err) => {
    console.error("Failed to initialize background jobs:", err);
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
});
