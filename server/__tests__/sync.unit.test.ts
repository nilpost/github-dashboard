import { describe, it, expect, vi, beforeEach } from "vitest";

// Fully mock the sync service's collaborators so this stays a pure unit test
// (no DB, no network) focused on one thing: a single failing repo must not
// abort the whole sync.
const { getAuthenticated, listRepositories, downloadPackageJson, clearCache } =
  vi.hoisted(() => ({
    getAuthenticated: vi.fn(),
    listRepositories: vi.fn(),
    downloadPackageJson: vi.fn(),
    clearCache: vi.fn(),
  }));

const { analyzeDependencies } = vi.hoisted(() => ({
  analyzeDependencies: vi.fn(),
}));

const { upsertRepository, upsertDependency, createRepositoryLog } = vi.hoisted(
  () => ({
    upsertRepository: vi.fn(),
    upsertDependency: vi.fn(),
    createRepositoryLog: vi.fn(),
  })
);

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    users = { getAuthenticated };
  },
}));

vi.mock("../services/github.service", () => ({
  githubService: { listRepositories, downloadPackageJson, clearCache },
}));

vi.mock("../services/dependency.service", () => ({
  dependencyService: { analyzeDependencies },
}));

vi.mock("../storage", () => ({
  upsertRepository,
  upsertDependency,
  createRepositoryLog,
}));

import { syncService } from "../services/sync.service";

describe("syncService.syncAllRepositories error isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = "ghp_test_token_for_unit_tests_only_00000";
    getAuthenticated.mockResolvedValue({ data: { login: "acme" } });
    downloadPackageJson.mockResolvedValue({ dependencies: { left: "^1.0.0" } });
    analyzeDependencies.mockResolvedValue([
      { dependencyName: "left", currentVersion: "^1.0.0", isOutdated: false, isDevelopment: false },
    ]);
    upsertDependency.mockResolvedValue({});
    createRepositoryLog.mockResolvedValue({});
  });

  it("continues past a repo that fails and records the error", async () => {
    listRepositories.mockResolvedValue([
      { name: "good", fullName: "acme/good", githubRepoId: "1" },
      { name: "bad", fullName: "acme/bad", githubRepoId: "2" },
    ]);

    // The "bad" repo blows up on upsert; the "good" one succeeds.
    upsertRepository.mockImplementation(async (data: any) => {
      if (data.name === "bad") {
        throw new Error("db write failed for bad repo");
      }
      return { id: 10, ...data };
    });

    const result = await syncService.syncAllRepositories(1);

    // Both repos were attempted...
    expect(result.reposCount).toBe(2);
    // ...the good one still produced a dependency...
    expect(result.depsCount).toBe(1);
    expect(upsertDependency).toHaveBeenCalledTimes(1);
    // ...and the failure was isolated and reported, not thrown.
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("acme/bad");
  });

  it("reports success with no errors when every repo syncs", async () => {
    listRepositories.mockResolvedValue([
      { name: "good", fullName: "acme/good", githubRepoId: "1" },
    ]);
    upsertRepository.mockImplementation(async (data: any) => ({ id: 11, ...data }));

    const result = await syncService.syncAllRepositories(1);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.reposCount).toBe(1);
    expect(result.depsCount).toBe(1);
  });
});
