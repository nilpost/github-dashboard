import cron from "node-cron";
import { syncService } from "../services/sync.service";
import { db } from "../db";
import { users } from "@shared/schema";

export async function initializeSyncJobs() {
  const syncInterval = process.env.SYNC_INTERVAL_MINUTES || "60";
  const intervalMinutes = parseInt(syncInterval);

  // Create cron schedule (runs every N minutes)
  // Cron format: minute hour day month dayOfWeek
  const cronSchedule = `*/${intervalMinutes} * * * *`;

  console.log(`Initializing sync jobs with interval: ${intervalMinutes} minutes`);

  cron.schedule(cronSchedule, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled repository sync...`);
    await runFullSync();
  });

  // Also log when jobs are scheduled
  console.log(`Sync job scheduled with pattern: ${cronSchedule}`);
}

// Guard against a slow sync overlapping the next scheduled tick, which would
// run two full syncs against the same rows concurrently.
let syncRunning = false;

export async function runFullSync() {
  if (syncRunning) {
    console.warn("Scheduled sync already running; skipping this tick");
    return;
  }
  syncRunning = true;
  try {
    // Get all users (MVP: single user, but structure for multi-user)
    const allUsers = await db.query.users.findMany();

    for (const user of allUsers) {
      try {
        console.log(`Syncing repositories for user ${user.username}...`);
        const result = await syncService.syncAllRepositories(user.id);

        if (result.success) {
          console.log(
            `✓ Sync completed for ${user.username}: ${result.message}`
          );
        } else {
          console.error(
            `✗ Sync failed for ${user.username}: ${result.message}`
          );
          console.error("Errors:", result.errors);
        }
      } catch (err) {
        console.error(`Failed to sync user ${user.username}:`, err);
      }
    }
  } catch (err) {
    console.error("Full sync failed:", err);
  } finally {
    syncRunning = false;
  }
}

// Export job runner for manual triggering
export function createSyncJobRunner() {
  return async (userId: number) => {
    console.log(`Manual sync triggered for user ${userId}`);
    const result = await syncService.syncAllRepositories(userId);
    console.log("Manual sync result:", result);
    return result;
  };
}
