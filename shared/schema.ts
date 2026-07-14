import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, serial, text, integer, boolean, timestamp, jsonb, varchar, pgEnum, uniqueIndex, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "running", "completed", "failed"]);
export const syncJobTypeEnum = pgEnum("sync_job_type", ["deps", "vulns", "architecture", "logs"]);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const repositories = pgTable(
  "repositories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    githubRepoId: text("github_repo_id").unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    description: text("description"),
    url: varchar("url", { length: 512 }).notNull(),
    language: varchar("language", { length: 100 }),
    starCount: integer("star_count").default(0),
    lastSyncedAt: timestamp("last_synced_at"),
    isPrivate: boolean("is_private").default(false),
    primaryLanguage: varchar("primary_language", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("idx_repositories_user_id_github_repo_id").on(
      table.userId,
      table.githubRepoId
    ),
  })
);

export const dependencies = pgTable(
  "dependencies",
  {
    id: serial("id").primaryKey(),
    repositoryId: integer("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    dependencyName: varchar("dependency_name", { length: 255 }).notNull(),
    currentVersion: varchar("current_version", { length: 100 }).notNull(),
    latestVersion: varchar("latest_version", { length: 100 }),
    isOutdated: boolean("is_outdated").default(false),
    isDevelopment: boolean("is_development").default(false),
    analyzedAt: timestamp("analyzed_at").defaultNow(),
  },
  (table) => ({
    repoIdIdx: uniqueIndex("idx_dependencies_repo_id_name").on(
      table.repositoryId,
      table.dependencyName
    ),
  })
);

export const unusedDependencies = pgTable(
  "unused_dependencies",
  {
    id: serial("id").primaryKey(),
    repositoryId: integer("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    dependencyName: varchar("dependency_name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }), // dependency | devDependency
    reason: text("reason"), // Why it's unused
    detectedAt: timestamp("detected_at").defaultNow(),
  },
  (table) => ({
    repoIdIdx: uniqueIndex("idx_unused_dependencies_repo_id_name").on(
      table.repositoryId,
      table.dependencyName
    ),
  })
);

export const vulnerabilities = pgTable(
  "vulnerabilities",
  {
    id: serial("id").primaryKey(),
    dependencyName: varchar("dependency_name", { length: 255 }),
    dependencyId: integer("dependency_id").references(() => dependencies.id, {
      onDelete: "cascade",
    }),
    repositoryId: integer("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    severity: severityEnum("severity").notNull(),
    cveId: varchar("cve_id", { length: 100 }),
    ghsaId: varchar("ghsa_id", { length: 100 }),
    description: text("description"),
    affectedVersions: text("affected_versions").array(),
    fixedVersion: varchar("fixed_version", { length: 100 }),
    source: varchar("source", { length: 100 }), // github-dependabot, snyk, owasp, etc
    discoveredAt: timestamp("discovered_at").defaultNow(),
    detectedAt: timestamp("detected_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    repoIdIdx: uniqueIndex("idx_vulnerabilities_repo_id_cve").on(
      table.repositoryId,
      table.cveId
    ),
  })
);

export const repositoryLogs = pgTable("repository_logs", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  buildUrl: varchar("build_url", { length: 512 }),
  message: text("message"),
  logOutput: text("log_output"),
  duration: integer("duration"), // milliseconds
  triggeredAt: timestamp("triggered_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const architectureData = pgTable("architecture_data", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  graphType: varchar("graph_type", { length: 100 }).notNull(), // dependency-graph, module-structure
  data: jsonb("data"), // Mermaid diagram data or nodes/edges
  fileStructure: jsonb("file_structure"), // File tree
  entrySystems: text("entry_systems").array(), // Main entry points
  generatedAt: timestamp("generated_at").defaultNow(),
  isStale: boolean("is_stale").default(false),
});

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  jobType: syncJobTypeEnum("job_type").notNull(),
  status: syncStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(repositories),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, { fields: [repositories.userId], references: [users.id] }),
  dependencies: many(dependencies),
  unusedDependencies: many(unusedDependencies),
  vulnerabilities: many(vulnerabilities),
  logs: many(repositoryLogs),
  architectureData: many(architectureData),
  syncJobs: many(syncJobs),
}));

export const dependenciesRelations = relations(dependencies, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [dependencies.repositoryId],
    references: [repositories.id],
  }),
  vulnerabilities: many(vulnerabilities),
}));

export const unusedDependenciesRelations = relations(unusedDependencies, ({ one }) => ({
  repository: one(repositories, {
    fields: [unusedDependencies.repositoryId],
    references: [repositories.id],
  }),
}));

export const vulnerabilitiesRelations = relations(vulnerabilities, ({ one }) => ({
  dependency: one(dependencies, {
    fields: [vulnerabilities.dependencyId],
    references: [dependencies.id],
  }),
  repository: one(repositories, {
    fields: [vulnerabilities.repositoryId],
    references: [repositories.id],
  }),
}));

export const repositoryLogsRelations = relations(repositoryLogs, ({ one }) => ({
  repository: one(repositories, {
    fields: [repositoryLogs.repositoryId],
    references: [repositories.id],
  }),
}));

export const architectureDataRelations = relations(architectureData, ({ one }) => ({
  repository: one(repositories, {
    fields: [architectureData.repositoryId],
    references: [repositories.id],
  }),
}));

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  repository: one(repositories, {
    fields: [syncJobs.repositoryId],
    references: [repositories.id],
  }),
}));

// Zod Schemas for validation
export const userSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const repositorySchema = createSelectSchema(repositories);
export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
});

export const dependencySchema = createSelectSchema(dependencies);
export const insertDependencySchema = createInsertSchema(dependencies).omit({
  id: true,
  analyzedAt: true,
});

export const unusedDependencySchema = createSelectSchema(unusedDependencies);
export const insertUnusedDependencySchema = createInsertSchema(unusedDependencies).omit({
  id: true,
  detectedAt: true,
});

export const vulnerabilitySchema = createSelectSchema(vulnerabilities);
export const insertVulnerabilitySchema = createInsertSchema(vulnerabilities).omit({
  id: true,
  discoveredAt: true,
});

// Auth validation
export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Settings validation
export const settingsSchema = z.object({
  githubToken: z.string().min(10),
  syncIntervalMinutes: z.number().min(5).max(1440),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = typeof repositories.$inferInsert;
export type Dependency = typeof dependencies.$inferSelect;
export type InsertDependency = typeof dependencies.$inferInsert;
export type UnusedDependency = typeof unusedDependencies.$inferSelect;
export type InsertUnusedDependency = typeof unusedDependencies.$inferInsert;
export type Vulnerability = typeof vulnerabilities.$inferSelect;
export type InsertVulnerability = typeof vulnerabilities.$inferInsert;
export type SyncJob = typeof syncJobs.$inferSelect;
export type RepositoryLog = typeof repositoryLogs.$inferSelect;
