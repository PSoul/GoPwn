import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3005)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./e2e",
  // The prototype currently uses a shared file-backed store, so browser smoke
  // runs must stay serial to avoid cross-test state races.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  },
})
