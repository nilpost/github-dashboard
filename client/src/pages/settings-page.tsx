import { useState } from "react";

export default function SettingsPage() {
  const [githubToken, setGithubToken] = useState("");
  const [syncInterval, setSyncInterval] = useState(60);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings/github-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ githubToken, syncIntervalMinutes: syncInterval }),
      });

      if (response.ok) {
        alert("Settings saved");
      } else {
        alert("Failed to save settings");
      }
    } catch (err) {
      alert("Error saving settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    try {
      const response = await fetch("/api/repositories/sync", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        alert("Sync started");
      } else {
        alert("Failed to start sync");
      }
    } catch (err) {
      alert("Error starting sync");
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">GitHub Integration</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">GitHub Token</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your GitHub personal access token (kept secure)
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Sync Frequency (minutes)
          </label>
          <select
            value={syncInterval}
            onChange={(e) => setSyncInterval(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
            <option value={240}>Every 4 hours</option>
            <option value={1440}>Daily</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Manual Sync</h2>
        <button
          onClick={handleSync}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Sync Now
        </button>
      </div>
    </div>
  );
}
