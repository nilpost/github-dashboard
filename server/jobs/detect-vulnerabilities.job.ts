import cron from "node-cron";
import { db } from "../db";
import { vulnerabilityService } from "../services/vulnerability.service";
import { vulnerabilities, repositories } from "@shared/schema";
import { eq } from "drizzle-orm";

// Guard against a slow scan overlapping the next scheduled tick, which would
// race two delete+insert passes against the same rows.
let detectionRunning = false;

export async function initializeVulnerabilityJobs() {
  const cronSchedule = "0 2 * * *";

  console.log("Initializing vulnerability detection jobs");

  cron.schedule(cronSchedule, async () => {
    console.log(
      `[${new Date().toISOString()}] Running vulnerability detection...`
    );
    await runVulnerabilityDetection();
  });

  console.log(`Vulnerability detection scheduled with pattern: ${cronSchedule}`);
}

type RepoRow = { id: number; fullName: string };

// Scan a single repository and replace its stored vulnerabilities with the
// current Dependabot alerts. Shared by the scheduled sweep and the manual
// per-repo endpoint so the delete+insert logic lives in exactly one place.
async function scanAndPersistRepository(repo: RepoRow): Promise<any[]> {
  const [owner, repoName] = repo.fullName.split("/");
  const alerts = await vulnerabilityService.fetchGitHubDependabotAlerts(
    owner,
    repoName
  );

  // Clear existing vulnerabilities for this repo, then insert the fresh set.
  await db
    .delete(vulnerabilities)
    .where(eq(vulnerabilities.repositoryId, repo.id));

  for (const alert of alerts) {
    await db.insert(vulnerabilities).values({
      repositoryId: repo.id,
      dependencyName: alert.dependencyName,
      severity: vulnerabilityService.mapSeverityLevel(alert.severity),
      cveId: alert.cveId,
      ghsaId: alert.ghsaId,
      description: alert.description,
      affectedVersions: alert.vulnerableVersions,
      fixedVersion: alert.fixedVersion,
      source: "github-dependabot",
      discoveredAt: new Date(alert.detectedAt),
      detectedAt: new Date(),
    });
  }

  return alerts;
}

export async function runVulnerabilityDetection() {
  if (detectionRunning) {
    console.warn("Vulnerability detection already running; skipping this tick");
    return;
  }
  detectionRunning = true;
  try {
    const repos = await db.query.repositories.findMany();

    for (const repo of repos) {
      try {
        console.log(`Scanning vulnerabilities for ${repo.fullName}...`);
        const alerts = await scanAndPersistRepository(repo);
        console.log(`✓ Found ${alerts.length} vulnerabilities in ${repo.fullName}`);
      } catch (err) {
        // Isolate failures so one bad repo doesn't abort the whole sweep.
        console.error(`Failed to scan ${repo.fullName}:`, err);
      }
    }

    console.log("Vulnerability detection completed");
  } catch (err) {
    console.error("Vulnerability detection failed:", err);
  } finally {
    detectionRunning = false;
  }
}

export async function runVulnerabilityScanForRepository(
  repositoryId: number
): Promise<any[]> {
  try {
    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.id, repositoryId),
    });

    if (!repo) {
      throw new Error("Repository not found");
    }

    console.log(`Manual vulnerability scan for ${repo.fullName}`);
    return await scanAndPersistRepository(repo);
  } catch (err) {
    console.error(`Vulnerability scan failed for repository ${repositoryId}:`, err);
    return [];
  }
}
