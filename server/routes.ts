import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { passport, hashPassword, sanitizeUser } from "./auth";
import * as storage from "./storage";
import { syncService } from "./services/sync.service";
import { loginSchema, registerSchema } from "@shared/schema";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";
import { AuthenticatedRequest } from "./types";
import { runVulnerabilityScanForRepository } from "./jobs/detect-vulnerabilities.job";
import "./types";

const router = Router();

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Throttle credential endpoints to blunt brute-force / credential-stuffing.
// Skipped under test so the suite's repeated login/register calls stay
// deterministic; production/dev get the real limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

// Validate the login body up front (parity with /register) so malformed
// credentials get a clean 400 instead of falling through to Passport.
function validateLogin(req: Request, res: Response, next: NextFunction) {
  try {
    loginSchema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    next(err);
  }
}

// Auth Routes
router.post("/register", authLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, data.username),
    });

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = hashPassword(data.password);
    const user = await storage.createUser({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      res.status(201).json(sanitizeUser(user));
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post(
  "/login",
  authLimiter,
  validateLogin,
  passport.authenticate("local"),
  (req, res) => {
    res.json(sanitizeUser(req.user as any));
  }
);

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ message: "Logged out" });
  });
});

router.get("/user", requireAuth, (req, res) => {
  res.json(sanitizeUser(req.user as any));
});

// Repository Routes
router.get("/repositories", requireAuth, async (req: any, res: any) => {
  try {
    const repos = await storage.getUserRepositories(req.user.id);
    res.json(repos);
  } catch (err) {
    console.error("Failed to fetch repositories:", err);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

router.get("/repositories/:id", requireAuth, async (req: any, res: any) => {
  try {
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }
    res.json(repo);
  } catch (err) {
    console.error("Failed to fetch repository:", err);
    res.status(500).json({ error: "Failed to fetch repository" });
  }
});

router.post("/repositories/sync", requireAuth, async (req: any, res: any) => {
  try {
    // Start sync in background
    syncService.syncAllRepositories(req.user.id).catch((err) => {
      console.error("Background sync failed:", err);
    });

    res.json({ message: "Sync started", status: "pending" });
  } catch (err) {
    console.error("Failed to start sync:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// Dependency Routes
router.get("/repositories/:id/dependencies", requireAuth, async (req: any, res: any) => {
  try {
    // Verify user owns this repo
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const deps = await storage.getDependenciesByRepo(parseInt(req.params.id));
    res.json(deps);
  } catch (err) {
    console.error("Failed to fetch dependencies:", err);
    res.status(500).json({ error: "Failed to fetch dependencies" });
  }
});

router.get("/dependencies/outdated", requireAuth, async (req: any, res: any) => {
  try {
    const repos = await storage.getUserRepositories(req.user.id);
    const outdated = [];

    for (const repo of repos) {
      const deps = repo.dependencies || [];
      const repoOutdated = deps.filter((d) => d.isOutdated);
      if (repoOutdated.length > 0) {
        outdated.push({
          repository: repo.name,
          repositoryId: repo.id,
          dependencies: repoOutdated,
        });
      }
    }

    res.json(outdated);
  } catch (err) {
    console.error("Failed to fetch outdated dependencies:", err);
    res.status(500).json({ error: "Failed to fetch outdated dependencies" });
  }
});

router.get("/dependencies/vulnerable", requireAuth, async (req: any, res: any) => {
  try {
    const repos = await storage.getUserRepositories(req.user.id);
    const vulnerable = [];

    for (const repo of repos) {
      const vulns = repo.vulnerabilities || [];
      if (vulns.length > 0) {
        vulnerable.push({
          repository: repo.name,
          repositoryId: repo.id,
          vulnerabilities: vulns,
        });
      }
    }

    res.json(vulnerable);
  } catch (err) {
    console.error("Failed to fetch vulnerable dependencies:", err);
    res.status(500).json({ error: "Failed to fetch vulnerable dependencies" });
  }
});

// Unused Dependencies Routes
router.get("/repositories/:id/unused-dependencies", requireAuth, async (req: any, res: any) => {
  try {
    // Verify user owns this repo
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const unused = await storage.getUnusedDependenciesByRepo(
      parseInt(req.params.id)
    );
    res.json(unused);
  } catch (err) {
    console.error("Failed to fetch unused dependencies:", err);
    res.status(500).json({ error: "Failed to fetch unused dependencies" });
  }
});

router.get("/dependencies/unused", requireAuth, async (req: any, res: any) => {
  try {
    const repos = await storage.getUserRepositories(req.user.id);
    const allUnused = [];

    for (const repo of repos) {
      const unused = await storage.getUnusedDependenciesByRepo(repo.id);
      if (unused.length > 0) {
        allUnused.push({
          repository: repo.name,
          repositoryId: repo.id,
          unusedDependencies: unused,
        });
      }
    }

    res.json(allUnused);
  } catch (err) {
    console.error("Failed to fetch unused dependencies:", err);
    res.status(500).json({ error: "Failed to fetch unused dependencies" });
  }
});

// Vulnerability Routes
router.get(
  "/repositories/:id/vulnerabilities",
  requireAuth,
  async (req: any, res: any) => {
    try {
      // Verify user owns this repo
      const repo = await storage.getRepositoryById(
        parseInt(req.params.id),
        req.user.id
      );
      if (!repo) {
        return res.status(404).json({ error: "Repository not found" });
      }

      const vulns = await storage.getVulnerabilitiesByRepo(
        parseInt(req.params.id)
      );
      res.json(vulns);
    } catch (err) {
      console.error("Failed to fetch vulnerabilities:", err);
      res.status(500).json({ error: "Failed to fetch vulnerabilities" });
    }
  }
);

router.get("/vulnerabilities/all", requireAuth, async (req: any, res: any) => {
  try {
    const repos = await storage.getUserRepositories(req.user.id);
    const allVulns = [];

    for (const repo of repos) {
      const vulns = repo.vulnerabilities || [];
      allVulns.push(...vulns.map((v) => ({ ...v, repositoryId: repo.id })));
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allVulns.sort(
      (a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]
    );

    res.json(allVulns);
  } catch (err) {
    console.error("Failed to fetch vulnerabilities:", err);
    res.status(500).json({ error: "Failed to fetch vulnerabilities" });
  }
});

router.post("/repositories/:id/vulnerabilities/scan", requireAuth, async (req: any, res: any) => {
  try {
    // Verify user owns this repo
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Run the scan function
    await runVulnerabilityScanForRepository(parseInt(req.params.id));

    res.json({ message: "Vulnerability scan completed", status: "completed" });
  } catch (err) {
    console.error("Failed to scan vulnerabilities:", err);
    res.status(500).json({ error: "Failed to scan vulnerabilities" });
  }
});

// Architecture Routes
router.get("/repositories/:id/architecture", requireAuth, async (req: any, res: any) => {
  try {
    // Verify user owns this repo
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const arch = await storage.getArchitectureData(parseInt(req.params.id));
    res.json(arch);
  } catch (err) {
    console.error("Failed to fetch architecture data:", err);
    res.status(500).json({ error: "Failed to fetch architecture data" });
  }
});

router.post(
  "/repositories/:id/architecture/regenerate",
  requireAuth,
  async (req: any, res: any) => {
    // Architecture regeneration is not wired up (architecture.service.ts has no
    // caller). Report 501 honestly rather than a fake "pending" that never
    // completes, so the client doesn't show progress for work that never runs.
    res
      .status(501)
      .json({ error: "Architecture regeneration is not implemented yet" });
  }
);

// Logs Routes
router.get("/repositories/:id/logs", requireAuth, async (req: any, res: any) => {
  try {
    // Verify user owns this repo
    const repo = await storage.getRepositoryById(
      parseInt(req.params.id),
      req.user.id
    );
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await storage.getRepositoryLogs(parseInt(req.params.id), limit);
    res.json(logs);
  } catch (err) {
    console.error("Failed to fetch logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Settings Routes
router.get("/settings", requireAuth, async (req: any, res: any) => {
  try {
    res.json({
      syncFrequency: parseInt(process.env.SYNC_INTERVAL_MINUTES || "60"),
    });
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.post("/settings/github-token", requireAuth, async (req: any, res: any) => {
  // Per-user GitHub token storage is not implemented — the app uses the
  // server-wide GITHUB_TOKEN env var. The previous handler replied "Token
  // saved" without persisting or verifying anything, which was misleading.
  // Return 501 until real (encrypted, verified) persistence exists.
  res
    .status(501)
    .json({ error: "Saving a per-user GitHub token is not implemented yet" });
});

export function registerRoutes(app: any) {
  app.use("/api", router);
}
