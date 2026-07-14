import { execSync } from "child_process";
import path from "path";
import fs from "fs";

interface PackageJsonDeps {
  [name: string]: string;
}

interface DependencyData {
  dependencyName: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  isDevelopment: boolean;
}

function parseVersionRange(versionRange: string): string {
  // Extract the base version from semver ranges like "^1.0.0", "~2.1.0", ">=3.0.0", etc
  const match = versionRange.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : versionRange;
}

function compareVersions(current: string, latest: string): boolean {
  // Simple semver comparison - returns true if current < latest
  const currentParts = parseVersionRange(current)
    .split(".")
    .map(Number);
  const latestParts = parseVersionRange(latest)
    .split(".")
    .map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const next = latestParts[i] || 0;

    if (curr < next) return true;
    if (curr > next) return false;
  }

  return false;
}

class DependencyService {
  async analyzeDependencies(packageJson: any): Promise<DependencyData[]> {
    if (!packageJson) {
      return [];
    }

    const dependencies: DependencyData[] = [];

    // Process regular dependencies
    if (packageJson.dependencies) {
      const regularDeps = await this.processDependencies(
        packageJson.dependencies,
        false
      );
      dependencies.push(...regularDeps);
    }

    // Process dev dependencies
    if (packageJson.devDependencies) {
      const devDeps = await this.processDependencies(
        packageJson.devDependencies,
        true
      );
      dependencies.push(...devDeps);
    }

    return dependencies;
  }

  private async processDependencies(
    deps: PackageJsonDeps,
    isDevelopment: boolean
  ): Promise<DependencyData[]> {
    const results: DependencyData[] = [];

    for (const [name, version] of Object.entries(deps)) {
      try {
        const latestVersion = await this.getLatestVersion(name);
        const currentVersion = parseVersionRange(version);
        const isOutdated =
          latestVersion && compareVersions(currentVersion, latestVersion);

        results.push({
          dependencyName: name,
          currentVersion: version,
          latestVersion,
          isOutdated: isOutdated || false,
          isDevelopment,
        });
      } catch (error) {
        // If we can't fetch latest version, still record the dependency
        results.push({
          dependencyName: name,
          currentVersion: version,
          isOutdated: false,
          isDevelopment,
        });
      }
    }

    return results;
  }

  private async getLatestVersion(packageName: string): Promise<string | undefined> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${packageName}/latest`,
        {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      return data.version || undefined;
    } catch (error) {
      console.warn(`Failed to fetch latest version for ${packageName}:`, error);
      return undefined;
    }
  }

  extractEntryPoints(packageJson: any): string[] {
    const entryPoints: Set<string> = new Set();

    if (packageJson.main) entryPoints.add(packageJson.main);
    if (packageJson.module) entryPoints.add(packageJson.module);
    if (packageJson.browser) {
      if (typeof packageJson.browser === "string") {
        entryPoints.add(packageJson.browser);
      } else if (typeof packageJson.browser === "object") {
        Object.values(packageJson.browser).forEach((v: any) => {
          if (typeof v === "string") entryPoints.add(v);
        });
      }
    }
    if (packageJson.exports) {
      const exports = packageJson.exports;
      if (typeof exports === "string") {
        entryPoints.add(exports);
      } else if (typeof exports === "object") {
        this.extractFromExports(exports, entryPoints);
      }
    }

    return Array.from(entryPoints);
  }

  private extractFromExports(
    exports: any,
    entryPoints: Set<string>
  ): void {
    for (const value of Object.values(exports)) {
      if (typeof value === "string") {
        entryPoints.add(value);
      } else if (typeof value === "object" && value !== null) {
        this.extractFromExports(value, entryPoints);
      }
    }
  }

  getPackagingType(packageJson: any): string {
    if (packageJson.type === "module") return "ESM";
    if (packageJson.type === "commonjs") return "CJS";

    // Guess based on exports or files
    if (packageJson.exports && typeof packageJson.exports === "object") {
      return "ESM";
    }

    return "CJS";
  }

  getMainTechnologies(packageJson: any): string[] {
    const techs: Set<string> = new Set();

    // Check frameworks and libraries in dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const techMap: Record<string, string> = {
      react: "React",
      vue: "Vue",
      angular: "@angular/core",
      svelte: "Svelte",
      express: "Express",
      fastify: "Fastify",
      hapi: "@hapi/hapi",
      koa: "Koa",
      typescript: "TypeScript",
      graphql: "GraphQL",
      jest: "Jest",
      mocha: "Mocha",
      webpack: "Webpack",
      vite: "Vite",
      rollup: "Rollup",
      tailwindcss: "Tailwind",
      styled: "styled-components",
      postgres: "PostgreSQL",
      mongodb: "MongoDB",
      redis: "Redis",
    };

    for (const [key, tech] of Object.entries(techMap)) {
      if (allDeps[key] || allDeps[tech]) {
        techs.add(tech);
      }
    }

    return Array.from(techs);
  }

  async detectUnusedDependencies(repoPath: string): Promise<any> {
    try {
      const result = JSON.parse(
        execSync("npx knip --reporter json", {
          cwd: repoPath,
          timeout: 30000,
          encoding: "utf-8",
        })
      );

      return result;
    } catch (error) {
      console.error(`Failed to detect unused dependencies in ${repoPath}:`, error);
      return { unused: [], unresolved: [], violations: [] };
    }
  }

  async parseKnipOutput(
    knipOutput: any,
    packageJson: any
  ): Promise<
    Array<{
      dependencyName: string;
      type: "dependency" | "devDependency";
      reason: string;
    }>
  > {
    const unusedDeps: Array<{
      dependencyName: string;
      type: "dependency" | "devDependency";
      reason: string;
    }> = [];

    if (!knipOutput.unused) {
      return [];
    }

    // Flatten the unused dependencies from knip output
    const allUnused = knipOutput.unused;

    for (const depName of allUnused) {
      const isDev = packageJson.devDependencies?.[depName];
      const isRegular = packageJson.dependencies?.[depName];

      unusedDeps.push({
        dependencyName: depName,
        type: isDev ? "devDependency" : "dependency",
        reason: "Detected as unused by knip analysis",
      });
    }

    return unusedDeps;
  }
}

export const dependencyService = new DependencyService();
