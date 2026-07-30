import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// The portfolio cockpit: what should I work on next, and what is blocked?
// Data comes from portfolio.json in the studio's ops repo, which is canonical —
// this page never writes back.

interface Project {
  id: string;
  type?: string;
  stage: string;
  health?: string;
  gate_next?: string | null;
  blocker?: string | null;
  blocked_on_human?: boolean;
  revenue_status?: string;
  revenue_note?: string;
  kill_recommended?: boolean;
  kill_criteria_met?: string[];
  notes?: string;
}

interface Portfolio {
  configured: boolean;
  reason?: string;
  generated?: string;
  ratified?: boolean;
  ratificationNote?: string;
  wipLimit?: number;
  wipUsed?: number;
  wipBreached?: boolean;
  stageCounts?: Record<string, number>;
  blockedOnHuman?: Project[];
  killRecommended?: Project[];
  revenue?: Project[];
  staleDays?: number | null;
  projects?: Project[];
}

const STAGE_ORDER = [
  "ACTIVE",
  "SHIP-BLOCKED",
  "MAINTAIN",
  "PARKED",
  "KILLED",
  "IDEA",
  "VALIDATE",
  "BUILD",
];

const HEALTH_DOT: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  unknown: "bg-gray-300",
};

function ProjectRow({ p }: { p: Project }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow flex items-start gap-3">
      <span
        className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
          HEALTH_DOT[p.health || "unknown"] || HEALTH_DOT.unknown
        }`}
        title={`health: ${p.health || "unknown"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold">{p.id}</h3>
          {p.gate_next && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              next: {p.gate_next}
            </span>
          )}
          {p.blocked_on_human && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
              needs a human
            </span>
          )}
          {p.kill_recommended && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
              kill proposed
            </span>
          )}
        </div>
        {p.blocker && (
          <p className="text-sm text-gray-700 mt-1">{p.blocker}</p>
        )}
        {p.kill_criteria_met && p.kill_criteria_met.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            criteria: {p.kill_criteria_met.join("; ")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const result = refresh
        ? await apiRequest("/api/portfolio/refresh", { method: "POST" })
        : await apiRequest("/api/portfolio");
      setData(result);
    } catch (err) {
      setError("Failed to load the portfolio");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return <div className="p-8">Loading portfolio...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  // Not configured is a normal state, not a failure — tell the user how to fix it.
  if (data && !data.configured) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Portfolio</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg max-w-2xl">
          <p className="font-semibold mb-1">Not configured</p>
          <p className="text-sm">{data.reason}</p>
        </div>
      </div>
    );
  }

  const projects = data?.projects || [];
  const stages = STAGE_ORDER.filter((s) =>
    projects.some((p) => p.stage === s)
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Generated {data?.generated}
        {typeof data?.staleDays === "number" &&
          data.staleDays > 0 &&
          ` · ${data.staleDays} day${data.staleDays === 1 ? "" : "s"} old`}
      </p>

      {data?.ratified === false && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg mb-6">
          <p className="font-semibold mb-1">Not ratified</p>
          <p className="text-sm">{data.ratificationNote}</p>
        </div>
      )}

      {/* Stale state is worse than no state, because it gets believed. */}
      {typeof data?.staleDays === "number" && data.staleDays >= 14 && (
        <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg mb-6 text-sm">
          Two or more weekly reviews have been missed. Treat this state as
          untrustworthy until an assurance pass re-verifies it.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Projects</h3>
          <p className="text-2xl font-bold">{projects.length}</p>
        </div>
        <div
          className={`p-4 rounded-lg shadow ${
            data?.wipBreached ? "bg-red-50" : "bg-white"
          }`}
        >
          <h3 className="text-gray-600 text-sm">Active / WIP limit</h3>
          <p className="text-2xl font-bold">
            {data?.wipUsed} / {data?.wipLimit}
          </p>
          {data?.wipBreached && (
            <p className="text-xs text-red-700 mt-1">Limit breached</p>
          )}
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Blocked on a human</h3>
          <p className="text-2xl font-bold">
            {data?.blockedOnHuman?.length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Kill proposed</h3>
          <p className="text-2xl font-bold">
            {data?.killRecommended?.length || 0}
          </p>
        </div>
      </div>

      {data?.blockedOnHuman && data.blockedOnHuman.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Waiting on you</h2>
          <p className="text-sm text-gray-600 mb-4">
            No agent can move these. They need no budget, only a person — usually
            the highest-leverage items here.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {data.blockedOnHuman.map((p) => (
              <ProjectRow key={`blocked-${p.id}`} p={p} />
            ))}
          </div>
        </section>
      )}

      {stages.map((stage) => (
        <section key={stage} className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            {stage}{" "}
            <span className="text-base font-normal text-gray-500">
              ({data?.stageCounts?.[stage] || 0})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {projects
              .filter((p) => p.stage === stage)
              .map((p) => (
                <ProjectRow key={p.id} p={p} />
              ))}
          </div>
        </section>
      ))}

      {data?.revenue && data.revenue.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Revenue</h2>
          <div className="grid grid-cols-1 gap-3">
            {data.revenue.map((p) => (
              <div key={`rev-${p.id}`} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{p.id}</h3>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    {p.revenue_status}
                  </span>
                </div>
                {p.revenue_note && (
                  <p className="text-sm text-gray-700 mt-1">{p.revenue_note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
