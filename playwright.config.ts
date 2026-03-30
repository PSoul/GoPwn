import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 4500)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  // E2E tests share a single PostgreSQL database, so browser smoke runs
  // stay serial to avoid cross-test state races.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Bypass local proxy for E2E tests hitting the dev server
    launchOptions: {
      args: ["--no-proxy-server"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      E2E_TEST_MODE: "true",
      NO_PROXY: "localhost,127.0.0.1",
      no_proxy: "localhost,127.0.0.1",
    },
    ignoreHTTPSErrors: true,
  },
})
