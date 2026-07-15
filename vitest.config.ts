import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    // Endpoint tests share a database; run test files sequentially to avoid
    // cross-file interference on the users/session tables.
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
