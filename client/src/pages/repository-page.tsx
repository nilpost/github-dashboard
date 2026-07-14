import { useRoute } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function RepositoryPage() {
  const [match, params] = useRoute("/repositories/:id");
  const [repository, setRepository] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dependencies");

  useEffect(() => {
    if (!params?.id) return;

    async function fetchRepository() {
      try {
        const id = params!.id;
        const data = await apiRequest(`/api/repositories/${id}`);
        setRepository(data);
      } catch (err) {
        console.error("Failed to load repository:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRepository();
  }, [params?.id]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!repository) {
    return <div className="p-8">Repository not found</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{repository.name}</h1>
      <p className="text-gray-600 mb-6">{repository.description}</p>

      <div className="mb-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("dependencies")}
            className={`pb-2 ${
              activeTab === "dependencies"
                ? "border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Dependencies
          </button>
          <button
            onClick={() => setActiveTab("vulnerabilities")}
            className={`pb-2 ${
              activeTab === "vulnerabilities"
                ? "border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Vulnerabilities
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`pb-2 ${
              activeTab === "architecture"
                ? "border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Architecture
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-2 ${
              activeTab === "logs"
                ? "border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        {activeTab === "dependencies" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Dependencies</h2>
            {repository.dependencies?.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Current</th>
                    <th className="text-left py-2">Latest</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {repository.dependencies.map((dep: any) => (
                    <tr key={dep.id} className="border-b">
                      <td className="py-2">{dep.dependencyName}</td>
                      <td>{dep.currentVersion}</td>
                      <td>{dep.latestVersion || "-"}</td>
                      <td>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            dep.isOutdated
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {dep.isOutdated ? "Outdated" : "Current"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-600">No dependencies found</p>
            )}
          </div>
        )}

        {activeTab === "vulnerabilities" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Vulnerabilities</h2>
            {repository.vulnerabilities?.length > 0 ? (
              <div className="space-y-2">
                {repository.vulnerabilities.map((vuln: any) => (
                  <div key={vuln.id} className="p-3 border rounded">
                    <p className="font-bold">{vuln.cveId || "CVE"}</p>
                    <p className="text-sm text-gray-600">{vuln.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No vulnerabilities found</p>
            )}
          </div>
        )}

        {activeTab === "architecture" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Architecture</h2>
            <p className="text-gray-600">Architecture graphs coming soon...</p>
          </div>
        )}

        {activeTab === "logs" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Logs</h2>
            {repository.logs?.length > 0 ? (
              <div className="space-y-2">
                {repository.logs.map((log: any) => (
                  <div key={log.id} className="p-3 border rounded">
                    <p className="font-bold">{log.message}</p>
                    <p className="text-xs text-gray-500">{log.triggeredAt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No logs found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
