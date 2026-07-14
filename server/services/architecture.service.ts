import { execSync } from "child_process";

class ArchitectureService {
  async analyzeArchitecture(repoPath: string): Promise<any> {
    try {
      const result = JSON.parse(
        execSync(
          "npx depcruise --output-type json --include-only '^(?!node_modules)' src/ lib/ index.js 2>/dev/null || true",
          {
            cwd: repoPath,
            timeout: 60000,
            encoding: "utf-8",
          }
        )
      );

      return result;
    } catch (error) {
      console.error(`Failed to analyze architecture in ${repoPath}:`, error);
      return { modules: [], violations: [] };
    }
  }

  generateMermaidDiagram(depCruiserOutput: any): string {
    if (!depCruiserOutput.modules || depCruiserOutput.modules.length === 0) {
      return "graph TD\n  A[No modules found]";
    }

    let mermaid = "graph TD\n";
    const modules = depCruiserOutput.modules;
    const addedNodes = new Set<string>();
    const addedEdges = new Set<string>();

    // Create nodes and edges
    for (const module of modules) {
      const moduleName = this.sanitizeModuleName(module.source);

      // Add node if not already added
      if (!addedNodes.has(moduleName)) {
        mermaid += `  ${moduleName}["${module.source}"]\n`;
        addedNodes.add(moduleName);
      }

      // Add edges for dependencies
      if (module.dependencies && module.dependencies.length > 0) {
        for (const dep of module.dependencies) {
          const depName = this.sanitizeModuleName(dep.resolved);
          const edgeKey = `${moduleName}->${depName}`;

          if (!addedEdges.has(edgeKey)) {
            mermaid += `  ${moduleName} --> ${depName}\n`;
            addedEdges.add(edgeKey);
          }
        }
      }
    }

    return mermaid || "graph TD\n  A[Architecture diagram generated]";
  }

  private sanitizeModuleName(name: string): string {
    // Convert paths to safe node identifiers
    return name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/^_+/, "")
      .replace(/_+$/, "")
      .substring(0, 40);
  }

  extractEntryPoints(depCruiserOutput: any): string[] {
    if (!depCruiserOutput.modules) {
      return [];
    }

    // Entry points are modules with no incoming dependencies from other modules
    const allModules = new Set(
      depCruiserOutput.modules.map((m: any) => m.source)
    );
    const modulesWithIncomingDeps = new Set<string>();

    for (const module of depCruiserOutput.modules) {
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (dep.resolved) {
            modulesWithIncomingDeps.add(dep.resolved);
          }
        }
      }
    }

    // Find modules that are not dependencies of others
    const entryPoints: string[] = [];
    for (const module of allModules) {
      const moduleName = module as string;
      if (!modulesWithIncomingDeps.has(moduleName)) {
        entryPoints.push(moduleName);
      }
    }

    return entryPoints.slice(0, 5); // Return top 5 entry points
  }

  detectCircularDependencies(depCruiserOutput: any): any[] {
    if (!depCruiserOutput.violations) {
      return [];
    }

    return depCruiserOutput.violations
      .filter((v: any) => v.type === "circular")
      .map((v: any) => ({
        type: "circular",
        path: v.from,
        module: v.to,
        severity: "high",
      }));
  }

  extractFileStructure(modules: any[]): any {
    const structure: Record<string, any> = {};

    for (const module of modules) {
      const parts = module.source.split("/");
      let current = structure;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      const fileName = parts[parts.length - 1];
      current[fileName] = {
        dependencies: module.dependencies?.length || 0,
        dependents: 0, // Would need to calculate from full graph
      };
    }

    return structure;
  }
}

export const architectureService = new ArchitectureService();
