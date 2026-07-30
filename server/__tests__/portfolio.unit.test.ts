import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the GitHub SDK the same way github.unit.test.ts does, so we exercise the
// portfolio service's parsing and summarising without a network call.
const { getContent } = vi.hoisted(() => ({ getContent: vi.fn() }));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    repos = { getContent };
  },
}));

import { portfolioService } from "../services/portfolio.service";
import { githubService } from "../services/github.service";

/** Wrap a portfolio object the way the GitHub contents API returns a file. */
function asGitHubFile(obj: unknown) {
  return {
    data: {
      type: "file",
      content: Buffer.from(JSON.stringify(obj), "utf-8").toString("base64"),
    },
  };
}

const VALID = {
  schema_version: 1,
  generated: new Date().toISOString().slice(0, 10),
  wip_limit: 2,
  ratified: false,
  ratification_note: "Awaiting founder sign-off.",
  projects: [
    { id: "alpha", stage: "ACTIVE", health: "amber", gate_next: "G4" },
    {
      id: "beta",
      stage: "ACTIVE",
      health: "green",
      gate_next: "G3",
      blocked_on_human: true,
      blocker: "Needs credentials",
    },
    { id: "gamma", stage: "PARKED", health: "unknown", kill_recommended: true },
    {
      id: "delta",
      stage: "MAINTAIN",
      health: "green",
      revenue_status: "designated-candidate",
    },
    { id: "epsilon", stage: "MAINTAIN", health: "green", revenue_status: "none" },
  ],
};

describe("portfolioService", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "ghp_test_token_for_unit_tests_only_00000";
    process.env.STUDIO_OPS_REPO = "acme/studio-ops";
    delete process.env.STUDIO_OPS_PATH;
    getContent.mockReset();
    githubService.clearCache();
    portfolioService.clearCache();
  });

  afterEach(() => {
    delete process.env.STUDIO_OPS_REPO;
    delete process.env.STUDIO_OPS_PATH;
  });

  it("reports not-configured (not an error) when STUDIO_OPS_REPO is unset", async () => {
    delete process.env.STUDIO_OPS_REPO;

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(false);
    expect(result.reason).toContain("STUDIO_OPS_REPO");
    expect(getContent).not.toHaveBeenCalled();
  });

  it("rejects a STUDIO_OPS_REPO that is not owner/name", async () => {
    process.env.STUDIO_OPS_REPO = "studio-ops";

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(false);
    expect(result.reason).toContain("owner/name");
  });

  it("summarises a valid portfolio", async () => {
    getContent.mockResolvedValue(asGitHubFile(VALID));

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(true);
    expect(result.projects).toHaveLength(5);
    expect(result.stageCounts).toEqual({ ACTIVE: 2, PARKED: 1, MAINTAIN: 2 });
    expect(result.wipUsed).toBe(2);
    expect(result.wipLimit).toBe(2);
    expect(result.wipBreached).toBe(false);
    expect(result.ratified).toBe(false);
    expect(result.blockedOnHuman?.map((p) => p.id)).toEqual(["beta"]);
    expect(result.killRecommended?.map((p) => p.id)).toEqual(["gamma"]);
    // revenue_status "none" must not count as a revenue project
    expect(result.revenue?.map((p) => p.id)).toEqual(["delta"]);
    expect(result.staleDays).toBe(0);
  });

  it("flags a breached WIP limit", async () => {
    getContent.mockResolvedValue(
      asGitHubFile({
        ...VALID,
        wip_limit: 1,
      })
    );

    const result = await portfolioService.getPortfolio();

    expect(result.wipUsed).toBe(2);
    expect(result.wipBreached).toBe(true);
  });

  it("computes staleness in days from the generated date", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    getContent.mockResolvedValue(
      asGitHubFile({ ...VALID, generated: tenDaysAgo })
    );

    const result = await portfolioService.getPortfolio();

    expect(result.staleDays).toBe(10);
  });

  it("surfaces a missing file as a readable reason rather than throwing", async () => {
    getContent.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(false);
    expect(result.reason).toContain("portfolio.json");
    expect(result.reason).toContain("acme/studio-ops");
  });

  it("surfaces malformed JSON as a readable reason rather than throwing", async () => {
    getContent.mockResolvedValue({
      data: {
        type: "file",
        content: Buffer.from("{ not json", "utf-8").toString("base64"),
      },
    });

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(false);
    expect(result.reason).toContain("could not be parsed");
  });

  it("rejects a portfolio whose projects lack an id or stage", async () => {
    getContent.mockResolvedValue(
      asGitHubFile({ ...VALID, projects: [{ id: "alpha" }] })
    );

    const result = await portfolioService.getPortfolio();

    expect(result.configured).toBe(false);
    expect(result.reason).toContain("without an id or stage");
  });

  it("caches, then refetches after clearCache", async () => {
    getContent.mockResolvedValue(asGitHubFile(VALID));

    await portfolioService.getPortfolio();
    await portfolioService.getPortfolio();
    expect(getContent).toHaveBeenCalledTimes(1);

    portfolioService.clearCache();
    githubService.clearCache();
    await portfolioService.getPortfolio();
    expect(getContent).toHaveBeenCalledTimes(2);
  });

  it("honours STUDIO_OPS_PATH when set", async () => {
    process.env.STUDIO_OPS_PATH = "state/portfolio.json";
    getContent.mockResolvedValue(asGitHubFile(VALID));

    await portfolioService.getPortfolio();

    expect(getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "studio-ops",
        path: "state/portfolio.json",
      })
    );
  });
});
