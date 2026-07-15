import { createServer } from "http";
import { Pool } from "pg";
import { createApp } from "./app";
import { closeDb } from "./db";
import { initializeAllJobs } from "./jobs";

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Postgres pool backing the session store and health check.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = await createApp(pool);
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
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
