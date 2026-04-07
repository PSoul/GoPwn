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
          exclude: ["tests/unit/hooks/**"],
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
      {
        plugins,
        test: {
          name: "hooks",
          include: ["tests/unit/hooks/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 15_000,
        },
      },
    ],
    benchmark: {
      include: ["tests/perf/**/*.bench.ts"],
    },
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
