import { githubService } from "./github.service";

// Portfolio cockpit.
//
// The studio's portfolio state lives in a separate ops repo as portfolio.json,
// which is CANONICAL. We deliberately do NOT mirror it into Postgres: a second
// copy is a second source of truth, and a dashboard that quietly disagrees with
// the file is worse than no dashboard, because it gets believed. This service
// fetches, validates, and caches — nothing else.
//
// Configure with:
//   STUDIO_OPS_REPO   owner/name of the ops repo (e.g. "nilpost/studio-ops")
//   STUDIO_OPS_PATH   path within it (default "portfolio.json")
//
// Unconfigured is a normal state, not an error — the rest of the app works
// without it.

export interface PortfolioProject {
  id: string;
  type?: string;
  path?: string;
  remote?: string;
  stage: string;
  health?: string;
  gate_next?: string | null;
  gate_evidence_needed?: string | null;
  blocker?: string | null;
  blocked_on_human?: boolean;
  owner_agent?: string | null;
  last_review?: string | null;
  last_commit?: string | null;
  token_spend_week?: number | null;
  revenue_status?: string;
  revenue_note?: string;
  kill_criteria_met?: string[];
  kill_recommended?: boolean;
  notes?: string;
}

export interface Portfolio {
  schema_version: number;
  generated: string;
  wip_limit: number;
  ratified?: boolean;
  ratification_note?: string;
  stage_values?: string[];
  projects: PortfolioProject[];
}

export interface PortfolioSummary {
  configured: boolean;
  reason?: string;
  generated?: string;
  ratified?: boolean;
  ratificationNote?: string;
  wipLimit?: number;
  wipUsed?: number;
  wipBreached?: boolean;
  stageCounts?: Record<string, number>;
  blockedOnHuman?: PortfolioProject[];
  killRecommended?: PortfolioProject[];
  revenue?: PortfolioProject[];
  staleDays?: number | null;
  projects?: PortfolioProject[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — this changes weekly, not per-request

class PortfolioService {
  private cache: { data: PortfolioSummary; timestamp: number } | null = null;

  /** Clear the cached portfolio so the next read refetches. */
  clearCache(): void {
    this.cache = null;
  }

  private notConfigured(reason: string): PortfolioSummary {
    return { configured: false, reason };
  }

  /**
   * Validates enough of the shape to guarantee the summary below is safe to
   * compute. Deliberately permissive about extra fields — the ops repo owns the
   * schema and may add to it without breaking this dashboard.
   */
  private parse(raw: string): Portfolio {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      throw new Error("portfolio.json is not an object");
    }
    if (!Array.isArray(data.projects)) {
      throw new Error("portfolio.json has no projects array");
    }
    for (const p of data.projects) {
      if (!p || typeof p.id !== "string" || typeof p.stage !== "string") {
        throw new Error("portfolio.json has a project without an id or stage");
      }
    }
    return data as Portfolio;
  }

  private summarize(p: Portfolio): PortfolioSummary {
    const stageCounts: Record<string, number> = {};
    for (const project of p.projects) {
      stageCounts[project.stage] = (stageCounts[project.stage] || 0) + 1;
    }

    const wipUsed = stageCounts["ACTIVE"] || 0;
    const wipLimit = typeof p.wip_limit === "number" ? p.wip_limit : 0;

    // How stale is this? The charter treats two missed weekly reviews as reason
    // to distrust the whole picture, so surface the age rather than hiding it.
    let staleDays: number | null = null;
    const generated = Date.parse(p.generated);
    if (!Number.isNaN(generated)) {
      staleDays = Math.floor((Date.now() - generated) / 86_400_000);
    }

    return {
      configured: true,
      generated: p.generated,
      ratified: p.ratified !== false,
      ratificationNote: p.ratification_note,
      wipLimit,
      wipUsed,
      wipBreached: wipLimit > 0 && wipUsed > wipLimit,
      stageCounts,
      blockedOnHuman: p.projects.filter((x) => x.blocked_on_human),
      killRecommended: p.projects.filter((x) => x.kill_recommended),
      revenue: p.projects.filter(
        (x) => x.revenue_status && x.revenue_status !== "none"
      ),
      staleDays,
      projects: p.projects,
    };
  }

  async getPortfolio(): Promise<PortfolioSummary> {
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const repoSpec = process.env.STUDIO_OPS_REPO;
    if (!repoSpec) {
      return this.notConfigured(
        "STUDIO_OPS_REPO is not set. Point it at the ops repo (e.g. owner/studio-ops) to enable the portfolio view."
      );
    }

    const [owner, repo] = repoSpec.split("/");
    if (!owner || !repo) {
      return this.notConfigured(
        `STUDIO_OPS_REPO must be in "owner/name" form, got "${repoSpec}".`
      );
    }

    const path = process.env.STUDIO_OPS_PATH || "portfolio.json";

    // getFileContent returns null for 404 and on fetch errors — it does not throw.
    const raw = await githubService.getFileContent(owner, repo, path);
    if (raw === null) {
      return this.notConfigured(
        `Could not read ${path} from ${repoSpec}. Check the repo exists and GITHUB_TOKEN can read it (a private ops repo needs the repo scope).`
      );
    }

    let summary: PortfolioSummary;
    try {
      summary = this.summarize(this.parse(raw));
    } catch (err) {
      // A malformed portfolio.json is a real problem worth surfacing plainly,
      // but it must not take the dashboard down.
      return this.notConfigured(
        `${path} in ${repoSpec} could not be parsed: ${(err as Error).message}`
      );
    }

    this.cache = { data: summary, timestamp: Date.now() };
    return summary;
  }
}

export const portfolioService = new PortfolioService();
