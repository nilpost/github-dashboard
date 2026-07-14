import { Octokit } from "@octokit/rest";

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class GitHubService {
  private octokit: Octokit | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_CACHE_TTL = 3600000; // 1 hour

  private initializeOctokit(): Octokit {
    if (!this.octokit) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error("GITHUB_TOKEN environment variable is required");
      }
      this.octokit = new Octokit({ auth: token });
    }
    return this.octokit;
  }

  private getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCached(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_CACHE_TTL,
    });
  }

  async listRepositories(username: string) {
    const cacheKey = `repos:${username}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const octokit = this.initializeOctokit();
      const repos: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await octokit.repos.listForUser({
          username,
          page,
          per_page: 100,
          type: "all",
          sort: "updated",
        });

        repos.push(...response.data);
        hasMore = response.data.length === 100;
        page++;
      }

      const result = repos.map((repo) => ({
        githubRepoId: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language,
        starCount: repo.stargazers_count,
        isPrivate: repo.private,
        primaryLanguage: repo.language,
        updatedAt: repo.updated_at,
      }));

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Error fetching repositories:", error);
      throw new Error("Failed to fetch repositories from GitHub");
    }
  }

  async fetchRepoMetadata(owner: string, repo: string) {
    const cacheKey = `repo:${owner}/${repo}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const octokit = this.initializeOctokit();
      const response = await octokit.repos.get({ owner, repo });

      const result = {
        githubRepoId: response.data.id.toString(),
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description,
        url: response.data.html_url,
        language: response.data.language,
        starCount: response.data.stargazers_count,
        isPrivate: response.data.private,
        primaryLanguage: response.data.language,
        topics: response.data.topics,
        defaultBranch: response.data.default_branch,
        updatedAt: response.data.updated_at,
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Error fetching repository metadata:", error);
      throw new Error(
        `Failed to fetch metadata for ${owner}/${repo} from GitHub`
      );
    }
  }

  async downloadPackageJson(owner: string, repo: string): Promise<any> {
    const cacheKey = `package:${owner}/${repo}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const octokit = this.initializeOctokit();

      // Try to fetch package.json from default branch
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: "package.json",
      });

      if (Array.isArray(response.data)) {
        throw new Error("Expected file, got directory");
      }

      const content = Buffer.from(response.data.content, "base64").toString(
        "utf-8"
      );
      const packageJson = JSON.parse(content);

      this.setCached(cacheKey, packageJson);
      return packageJson;
    } catch (error) {
      // Return null if package.json doesn't exist
      if ((error as any).status === 404) {
        return null;
      }
      console.error(
        `Error downloading package.json for ${owner}/${repo}:`,
        error
      );
      return null;
    }
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<string | null> {
    try {
      const octokit = this.initializeOctokit();
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data)) {
        throw new Error("Expected file, got directory");
      }

      return Buffer.from(response.data.content, "base64").toString("utf-8");
    } catch (error) {
      if ((error as any).status === 404) {
        return null;
      }
      console.error(`Error fetching ${path} from ${owner}/${repo}:`, error);
      return null;
    }
  }

  async getRepositoryFiles(owner: string, repo: string): Promise<string[]> {
    const cacheKey = `files:${owner}/${repo}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const octokit = this.initializeOctokit();
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: "/",
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      const files = response.data
        .filter((item) => item.type === "file")
        .map((item) => item.name);

      this.setCached(cacheKey, files);
      return files;
    } catch (error) {
      console.error(`Error fetching files from ${owner}/${repo}:`, error);
      return [];
    }
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const githubService = new GitHubService();
