import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface Repository {
  id: number;
  name: string;
  description: string;
  language: string;
  starCount: number;
  lastSyncedAt: string;
  url: string;
}

export default function DashboardPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRepositories() {
      try {
        const data = await apiRequest("/api/repositories");
        setRepositories(data);
      } catch (err) {
        setError("Failed to load repositories");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchRepositories();
  }, []);

  if (loading) {
    return <div className="p-8">Loading repositories...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Total Repositories</h3>
          <p className="text-2xl font-bold">{repositories.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Critical Vulnerabilities</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-600 text-sm">Outdated Packages</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Repositories</h2>
      <div className="grid grid-cols-1 gap-4">
        {repositories.map((repo) => (
          <div key={repo.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold">{repo.name}</h3>
                <p className="text-gray-600 text-sm">{repo.description}</p>
                <div className="flex gap-4 mt-2">
                  {repo.language && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {repo.language}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">⭐ {repo.starCount}</span>
                </div>
              </div>
              <a
                href={`/repositories/${repo.id}`}
                className="text-blue-600 hover:underline"
              >
                View Details →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
