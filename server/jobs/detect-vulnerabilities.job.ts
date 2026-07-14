import cron from "node-cron";
import { db } from "../db";
import { vulnerabilityService } from "../services/vulnerability.service";
import { vulnerabilities } from "@shared/schema";

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

export async function runVulnerabilityDetection() {
  try {
    const repos = await db.query.repositories.findMany();

    for (const repo of repos) {
      try {
        console.log(`Scanning vulnerabilities for ${repo.fullName}...`);

        const [owner, repoName] = repo.fullName.split("/");
        const alerts = await vulnerabilityService.fetchGitHubDependabotAlerts(
          owner,
          repoName
        );

        // Clear existing vulnerabilities for this repo
        await db
          .delete(vulnerabilities)
          .where((t: any) => t.repositoryId === repo.id);

        // Insert new vulnerabilities
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

        console.log(`✓ Found ${alerts.length} vulnerabilities in ${repo.fullName}`);
      } catch (err) {
        console.error(`Failed to scan ${repo.fullName}:`, err);
      }
    }

    console.log("Vulnerability detection completed");
  } catch (err) {
    console.error("Vulnerability detection failed:", err);
  }
}

export async function runVulnerabilityScanForRepository(
  repositoryId: number
): Promise<any[]> {
  try {
    const repo = await db.query.repositories.findFirst({
      where: (table: any) => table.id === repositoryId,
    });

    if (!repo) {
      throw new Error("Repository not found");
    }

    console.log(`Manual vulnerability scan for ${repo.fullName}`);

    const [owner, repoName] = repo.fullName.split("/");
    const alerts = await vulnerabilityService.fetchGitHubDependabotAlerts(
      owner,
      repoName
    );

    // Clear existing vulnerabilities
    await db
      .delete(vulnerabilities)
      .where((t: any) => t.repositoryId === repo.id);

    // Insert new vulnerabilities
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
  } catch (err) {
    console.error(`Vulnerability scan failed for repository ${repositoryId}:`, err);
    return [];
  }
}
