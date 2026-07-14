import { initializeSyncJobs } from "./sync-repositories.job";
import { initializeVulnerabilityJobs } from "./detect-vulnerabilities.job";

export async function initializeAllJobs() {
  console.log("Initializing background jobs...");

  try {
    initializeSyncJobs();
    initializeVulnerabilityJobs();

    console.log("All background jobs initialized successfully");
  } catch (err) {
    console.error("Failed to initialize background jobs:", err);
    throw err;
  }
}

export { initializeSyncJobs, initializeVulnerabilityJobs };
