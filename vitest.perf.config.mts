import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/perf/**/*.perf.ts", "tests/perf/**/*.bench.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 120_000,
    fileParallelism: false,
  },
})
