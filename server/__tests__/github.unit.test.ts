import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the GitHub SDK so we can drive success and failure paths without a
// network call and assert how the service surfaces each.
const { listForUser, getRepo, getContent } = vi.hoisted(() => ({
  listForUser: vi.fn(),
  getRepo: vi.fn(),
  getContent: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    repos = {
      listForUser,
      get: getRepo,
      getContent,
    };
  },
}));

import { githubService } from "../services/github.service";

describe("githubService failure handling", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "ghp_test_token_for_unit_tests_only_00000";
    listForUser.mockReset();
    getRepo.mockReset();
    getContent.mockReset();
    githubService.clearCache();
  });

  it("wraps a listRepositories API error in a friendly message", async () => {
    listForUser.mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(githubService.listRepositories("acme")).rejects.toThrow(
      "Failed to fetch repositories from GitHub"
    );
  });

  it("wraps a fetchRepoMetadata API error in a friendly message", async () => {
    getRepo.mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(
      githubService.fetchRepoMetadata("acme", "web")
    ).rejects.toThrow("Failed to fetch metadata for acme/web from GitHub");
  });

  it("returns null (not an error) when package.json is missing (404)", async () => {
    getContent.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));

    const result = await githubService.downloadPackageJson("acme", "web");
    expect(result).toBeNull();
  });

  it("returns null when downloading package.json fails for other reasons", async () => {
    getContent.mockRejectedValue(new Error("network down"));

    const result = await githubService.downloadPackageJson("acme", "web");
    expect(result).toBeNull();
  });

  it("parses and returns package.json content on success", async () => {
    const pkg = { name: "web", version: "1.0.0" };
    getContent.mockResolvedValue({
      data: {
        type: "file",
        content: Buffer.from(JSON.stringify(pkg)).toString("base64"),
      },
    });

    const result = await githubService.downloadPackageJson("acme", "web");
    expect(result).toEqual(pkg);
  });
});
