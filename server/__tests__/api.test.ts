import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import type { Express } from "express";
import { createApp } from "../app";
import { closeDb } from "../db";

let app: Express;
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  app = await createApp(pool);
  // Clean slate for the auth flow (session table is created lazily by the store).
  await pool.query("TRUNCATE users RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
  await closeDb();
});

describe("GET /api/health", () => {
  it("returns 200 and reports the database as connected", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
  });
});

describe("unknown API routes", () => {
  it("returns a JSON 404, not the SPA HTML fallback", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("auth flow", () => {
  it("registers a user without leaking the password hash", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ username: "alice", email: "alice@example.com", password: "supersecret123" });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe("alice");
    expect(res.body.email).toBe("alice@example.com");
    expect(res.body).not.toHaveProperty("password");
  });

  it("rejects duplicate usernames", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ username: "alice", email: "other@example.com", password: "supersecret123" });
    expect(res.status).toBe(400);
  });

  it("persists a session across requests (login → /api/user)", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/register")
      .send({ username: "bob", email: "bob@example.com", password: "supersecret123" })
      .expect(201);

    const me = await agent.get("/api/user");
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("bob");
    expect(me.body).not.toHaveProperty("password");

    const repos = await agent.get("/api/repositories");
    expect(repos.status).toBe(200);
    expect(Array.isArray(repos.body)).toBe(true);
  });

  it("logs in an existing user and rejects a wrong password", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: "alice", password: "supersecret123" })
      .expect(200);

    await request(app)
      .post("/api/login")
      .send({ username: "alice", password: "wrong-password" })
      .expect(401);
  });

  it("returns 401 for /api/user without a session", async () => {
    const res = await request(app).get("/api/user");
    expect(res.status).toBe(401);
  });
});
