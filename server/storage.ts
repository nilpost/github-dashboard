import { db } from "./db";
import {
  users,
  repositories,
  dependencies,
  unusedDependencies,
  vulnerabilities,
  repositoryLogs,
  syncJobs,
  architectureData,
  InsertUser,
  InsertRepository,
  InsertDependency,
  InsertUnusedDependency,
  InsertVulnerability,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Users
export async function getUserById(id: number) {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function createUser(data: InsertUser) {
  const result = await db.insert(users).values(data).returning();
  return result[0];
}

// Repositories
export async function getUserRepositories(userId: number) {
  return await db.query.repositories.findMany({
    where: eq(repositories.userId, userId),
    with: {
      dependencies: true,
      vulnerabilities: true,
    },
  });
}

export async function getRepositoryById(id: number, userId: number) {
  return await db.query.repositories.findFirst({
    where: and(eq(repositories.id, id), eq(repositories.userId, userId)),
    with: {
      dependencies: true,
      vulnerabilities: true,
      logs: true,
      architectureData: true,
    },
  });
}

export async function upsertRepository(data: InsertRepository & { userId: number }) {
  const { userId, githubRepoId, ...rest } = data;
  const existing = await db.query.repositories.findFirst({
    where: and(
      eq(repositories.userId, userId),
      eq(repositories.githubRepoId, githubRepoId)
    ),
  });

  if (existing) {
    const result = await db
      .update(repositories)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(repositories.id, existing.id))
      .returning();
    return result[0];
  } else {
    const result = await db
      .insert(repositories)
      .values({ userId, githubRepoId, ...rest })
      .returning();
    return result[0];
  }
}

// Dependencies
export async function getDependenciesByRepo(repositoryId: number) {
  return await db.query.dependencies.findMany({
    where: eq(dependencies.repositoryId, repositoryId),
  });
}

export async function upsertDependency(data: InsertDependency) {
  const existing = await db.query.dependencies.findFirst({
    where: and(
      eq(dependencies.repositoryId, data.repositoryId),
      eq(dependencies.dependencyName, data.dependencyName)
    ),
  });

  if (existing) {
    const result = await db
      .update(dependencies)
      .set(data)
      .where(eq(dependencies.id, existing.id))
      .returning();
    return result[0];
  } else {
    const result = await db.insert(dependencies).values(data).returning();
    return result[0];
  }
}

// Unused Dependencies
export async function getUnusedDependenciesByRepo(repositoryId: number) {
  return await db.query.unusedDependencies.findMany({
    where: eq(unusedDependencies.repositoryId, repositoryId),
  });
}

export async function upsertUnusedDependency(data: InsertUnusedDependency) {
  const existing = await db.query.unusedDependencies.findFirst({
    where: and(
      eq(unusedDependencies.repositoryId, data.repositoryId),
      eq(unusedDependencies.dependencyName, data.dependencyName)
    ),
  });

  if (existing) {
    const result = await db
      .update(unusedDependencies)
      .set(data)
      .where(eq(unusedDependencies.id, existing.id))
      .returning();
    return result[0];
  } else {
    const result = await db.insert(unusedDependencies).values(data).returning();
    return result[0];
  }
}

// Vulnerabilities
export async function getVulnerabilitiesByRepo(repositoryId: number) {
  return await db.query.vulnerabilities.findMany({
    where: eq(vulnerabilities.repositoryId, repositoryId),
    with: {
      dependency: true,
    },
  });
}

export async function insertVulnerability(data: InsertVulnerability) {
  const result = await db.insert(vulnerabilities).values(data).returning();
  return result[0];
}

// Sync Jobs
export async function createSyncJob(
  repositoryId: number,
  jobType: "deps" | "vulns" | "architecture" | "logs"
) {
  const result = await db
    .insert(syncJobs)
    .values({
      repositoryId,
      jobType,
      status: "pending",
    })
    .returning();
  return result[0];
}

export async function updateSyncJobStatus(
  id: number,
  status: "running" | "completed" | "failed",
  errorMessage?: string
) {
  const result = await db
    .update(syncJobs)
    .set({
      status,
      errorMessage,
      lastRunAt: new Date(),
      nextScheduledAt:
        status === "completed" ? new Date(Date.now() + 3600000) : undefined,
    })
    .where(eq(syncJobs.id, id))
    .returning();
  return result[0];
}

// Repository Logs
export async function createRepositoryLog(
  repositoryId: number,
  status: string,
  message: string,
  logOutput?: string
) {
  const result = await db
    .insert(repositoryLogs)
    .values({
      repositoryId,
      status,
      message,
      logOutput,
    })
    .returning();
  return result[0];
}

export async function getRepositoryLogs(repositoryId: number, limit = 50) {
  return await db.query.repositoryLogs.findMany({
    where: eq(repositoryLogs.repositoryId, repositoryId),
    limit,
  });
}

// Architecture Data
export async function upsertArchitectureData(
  repositoryId: number,
  graphType: string,
  data: any
) {
  const existing = await db.query.architectureData.findFirst({
    where: and(
      eq(architectureData.repositoryId, repositoryId),
      eq(architectureData.graphType, graphType)
    ),
  });

  if (existing) {
    const result = await db
      .update(architectureData)
      .set({ data, isStale: false, generatedAt: new Date() })
      .where(eq(architectureData.id, existing.id))
      .returning();
    return result[0];
  } else {
    const result = await db
      .insert(architectureData)
      .values({ repositoryId, graphType, data })
      .returning();
    return result[0];
  }
}

export async function getArchitectureData(repositoryId: number) {
  return await db.query.architectureData.findMany({
    where: eq(architectureData.repositoryId, repositoryId),
  });
}
