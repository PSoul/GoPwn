import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

const plugins = [tsconfigPaths()]

export default defineConfig({
  plugins,
  test: {
    projects: [
      {
        plugins,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 15_000,
        },
      },
      {
        plugins,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.{ts,tsx}"],
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      exclude: [
        "tests/**",
        "lib/generated/**",
        "node_modules/**",
        "*.config.*",
        "mcps/**",
        ".next/**",
      ],
    },
  },
})
