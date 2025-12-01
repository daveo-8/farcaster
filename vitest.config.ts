import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupTests.ts"],
    exclude: [
      "Oracle Control/**",
      "OracleControl/**",
      "node_modules"
    ],
    coverage: {
      provider: "v8",
      include: ["src"],
      exclude: [
        "src/app/.well-known/**",
        "src/app/api/**",
        "src/hooks/**",
        "src/lib/**",
        "Oracle Control/**",
        "OracleControl/**",
        "node_modules",
        "src/components/ui/wallet/**"
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
