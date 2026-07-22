import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import type { Express } from "express";
import { createApp } from "../app";
import { closeDb } from "../db";
import * as storage from "../storage";

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

// CSRF is active in every environment, so state-changing requests need the
// token echoed in a header. Fetch it (and set the cookie on the agent) first.
type Agent = ReturnType<typeof request.agent>;
async function csrfToken(agent: Agent): Promise<string> {
  const res = await agent.get("/api/csrf").expect(200);
  return res.body.csrfToken as string;
}

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

describe("CSRF protection", () => {
  it("rejects a state-changing request with no token (403)", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ username: "notoken", email: "notoken@example.com", password: "supersecret123" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Invalid CSRF token" });
  });

  it("rejects a state-changing request whose token does not match the cookie", async () => {
    const agent = request.agent(app);
    await csrfToken(agent); // sets the cookie on the agent
    const res = await agent
      .post("/api/register")
      .set("x-csrf-token", "not-the-real-token")
      .send({ username: "badtoken", email: "badtoken@example.com", password: "supersecret123" });
    expect(res.status).toBe(403);
  });

  it("allows a state-changing request with a matching token", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const res = await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "goodtoken", email: "goodtoken@example.com", password: "supersecret123" });
    expect(res.status).toBe(201);
  });
});

describe("auth flow", () => {
  it("registers a user without leaking the password hash", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const res = await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "alice", email: "alice@example.com", password: "supersecret123" });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe("alice");
    expect(res.body.email).toBe("alice@example.com");
    expect(res.body).not.toHaveProperty("password");
  });

  it("rejects duplicate usernames", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const res = await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "alice", email: "other@example.com", password: "supersecret123" });
    expect(res.status).toBe(400);
  });

  it("persists a session across requests (login → /api/user)", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);

    await agent
      .post("/api/register")
      .set("x-csrf-token", token)
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
    const token = await csrfToken(agent);
    await agent
      .post("/api/login")
      .set("x-csrf-token", token)
      .send({ username: "alice", password: "supersecret123" })
      .expect(200);

    const wrong = request.agent(app);
    const wrongToken = await csrfToken(wrong);
    await wrong
      .post("/api/login")
      .set("x-csrf-token", wrongToken)
      .send({ username: "alice", password: "wrong-password" })
      .expect(401);
  });

  it("returns 401 for /api/user without a session", async () => {
    const res = await request(app).get("/api/user");
    expect(res.status).toBe(401);
  });

  it("logs out and drops the session", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "carol", email: "carol@example.com", password: "supersecret123" })
      .expect(201);

    // Session is live before logout.
    await agent.get("/api/user").expect(200);

    const out = await agent.post("/api/logout").set("x-csrf-token", token);
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: "Logged out" });

    // Session is gone after logout.
    await agent.get("/api/user").expect(401);
  });

  it("rejects a malformed login body with 400 before authentication", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const res = await agent
      .post("/api/login")
      .set("x-csrf-token", token)
      .send({ username: "ab", password: "x" }); // too short for loginSchema
    expect(res.status).toBe(400);
  });
});

describe("resource authorization", () => {
  it("does not let one user read another user's repository", async () => {
    // Owner registers and gets a repository inserted under their account.
    const ownerAgent = request.agent(app);
    const ownerToken = await csrfToken(ownerAgent);
    const owner = await ownerAgent
      .post("/api/register")
      .set("x-csrf-token", ownerToken)
      .send({ username: "owner1", email: "owner1@example.com", password: "supersecret123" })
      .expect(201);

    const repo = await storage.upsertRepository({
      userId: owner.body.id,
      githubRepoId: "999001",
      name: "secret-repo",
      fullName: "owner1/secret-repo",
      url: "https://github.com/owner1/secret-repo",
    });

    // Owner can read it.
    await ownerAgent.get(`/api/repositories/${repo.id}`).expect(200);

    // A different user cannot — scoping is by userId, so it reads as 404.
    const otherAgent = request.agent(app);
    const otherToken = await csrfToken(otherAgent);
    await otherAgent
      .post("/api/register")
      .set("x-csrf-token", otherToken)
      .send({ username: "intruder", email: "intruder@example.com", password: "supersecret123" })
      .expect(201);

    const res = await otherAgent.get(`/api/repositories/${repo.id}`);
    expect(res.status).toBe(404);
  });
});

describe("unimplemented endpoints report 501", () => {
  it("returns 501 for saving a per-user GitHub token", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "dave", email: "dave@example.com", password: "supersecret123" })
      .expect(201);

    const res = await agent
      .post("/api/settings/github-token")
      .set("x-csrf-token", token)
      .send({ githubToken: "ghp_some_token_value" });
    expect(res.status).toBe(501);
  });

  it("returns 501 for architecture regeneration", async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    await agent
      .post("/api/register")
      .set("x-csrf-token", token)
      .send({ username: "erin", email: "erin@example.com", password: "supersecret123" })
      .expect(201);

    const res = await agent
      .post("/api/repositories/1/architecture/regenerate")
      .set("x-csrf-token", token);
    expect(res.status).toBe(501);
  });
});
