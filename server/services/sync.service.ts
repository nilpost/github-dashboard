import { githubService } from "./github.service";
import { dependencyService } from "./dependency.service";
import * as storage from "../storage";
import { Octokit } from "@octokit/rest";

interface SyncResult {
  success: boolean;
  message: string;
  reposCount: number;
  depsCount: number;
  errors: string[];
}

class SyncService {
  async syncAllRepositories(userId: number): Promise<SyncResult> {
    const errors: string[] = [];
    let reposCount = 0;
    let depsCount = 0;

    try {
      // Get username from GitHub token
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const userResponse = await octokit.users.getAuthenticated();
      const username = userResponse.data.login;

      console.log(`Syncing repositories for user ${username}...`);

      // Fetch all repositories from GitHub
      const repos = await githubService.listRepositories(username);
      reposCount = repos.length;

      // Sync each repository
      for (const repo of repos) {
        try {
          // Upsert repository in database
          const savedRepo = await storage.upsertRepository({
            userId,
            ...repo,
          });

          // Fetch and analyze dependencies
          const packageJson = await githubService.downloadPackageJson(
            userResponse.data.login,
            repo.name
          );

          if (packageJson) {
            // Analyze dependencies
            const deps = await dependencyService.analyzeDependencies(
              packageJson
            );

            // Save dependencies to database
            for (const dep of deps) {
              await storage.upsertDependency({
                repositoryId: savedRepo.id,
                ...dep,
              });
              depsCount++;
            }

            // Log successful sync
            await storage.createRepositoryLog(
              savedRepo.id,
              "success",
              `Synced ${deps.length} dependencies`
            );
          }
        } catch (err) {
          const errorMsg = `Failed to sync repo ${repo.fullName}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Clear GitHub service cache after sync
      githubService.clearCache();

      return {
        success: errors.length === 0,
        message: `Synced ${reposCount} repositories with ${depsCount} dependencies`,
        reposCount,
        depsCount,
        errors,
      };
    } catch (error) {
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);

      return {
        success: false,
        message: errorMsg,
        reposCount,
        depsCount,
        errors: [...errors, errorMsg],
      };
    }
  }

  async syncRepository(
    userId: number,
    repositoryId: number
  ): Promise<SyncResult> {
    const errors: string[] = [];
    let reposCount = 0;
    let depsCount = 0;

    try {
      // Get repository from database
      const repo = await storage.getRepositoryById(repositoryId, userId);
      if (!repo) {
        return {
          success: false,
          message: "Repository not found",
          reposCount,
          depsCount,
          errors: ["Repository not found"],
        };
      }

      // Get GitHub username
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const userResponse = await octokit.users.getAuthenticated();

      const [owner, repoName] = repo.fullName.split("/");

      // Fetch repository metadata
      const metadata = await githubService.fetchRepoMetadata(owner, repoName);

      // Update repository in database
      const updatedRepo = await storage.upsertRepository({
        userId,
        ...metadata,
      });
      reposCount = 1;

      // Fetch and analyze dependencies
      const packageJson = await githubService.downloadPackageJson(
        owner,
        repoName
      );

      if (packageJson) {
        const deps = await dependencyService.analyzeDependencies(packageJson);

        // Save dependencies
        for (const dep of deps) {
          await storage.upsertDependency({
            repositoryId: updatedRepo.id,
            ...dep,
          });
          depsCount++;
        }

        // Log successful sync
        await storage.createRepositoryLog(
          updatedRepo.id,
          "success",
          `Synced ${deps.length} dependencies`
        );
      }

      githubService.clearCache(`repo:${owner}/${repoName}`);

      return {
        success: true,
        message: `Synced repository with ${depsCount} dependencies`,
        reposCount,
        depsCount,
        errors,
      };
    } catch (error) {
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);

      return {
        success: false,
        message: errorMsg,
        reposCount,
        depsCount,
        errors: [...errors, errorMsg],
      };
    }
  }

  async analyzeDependencies(userId: number, repositoryId: number) {
    try {
      const repo = await storage.getRepositoryById(repositoryId, userId);
      if (!repo) {
        throw new Error("Repository not found");
      }

      const [owner, repoName] = repo.fullName.split("/");
      const packageJson = await githubService.downloadPackageJson(
        owner,
        repoName
      );

      if (!packageJson) {
        throw new Error("package.json not found");
      }

      return await dependencyService.analyzeDependencies(packageJson);
    } catch (error) {
      console.error("Dependency analysis failed:", error);
      throw error;
    }
  }

  async getEntryPoints(userId: number, repositoryId: number): Promise<string[]> {
    try {
      const repo = await storage.getRepositoryById(repositoryId, userId);
      if (!repo) {
        throw new Error("Repository not found");
      }

      const [owner, repoName] = repo.fullName.split("/");
      const packageJson = await githubService.downloadPackageJson(
        owner,
        repoName
      );

      if (!packageJson) {
        return [];
      }

      return dependencyService.extractEntryPoints(packageJson);
    } catch (error) {
      console.error("Failed to get entry points:", error);
      return [];
    }
  }
}

export const syncService = new SyncService();
