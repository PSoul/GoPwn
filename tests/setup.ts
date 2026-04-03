import "dotenv/config"

// Skip real MCP stdio integration tests by default — they require Docker
// and real MCP server processes. Run with SKIP_MCP_INTEGRATION=0 to enable.
if (!process.env.SKIP_MCP_INTEGRATION) {
  process.env.SKIP_MCP_INTEGRATION = "1"
}

import { existsSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach } from "vitest"

const isNodeEnv = typeof window === "undefined"

let cleanup: () => void = () => {}
if (!isNodeEnv) {
  // Use dynamic import with .then() to avoid top-level await (incompatible with tsconfig module setting)
  import("@testing-library/jest-dom/vitest").catch(() => {})
  import("@testing-library/react").then((mod) => { cleanup = mod.cleanup }).catch(() => {})
}

import { cleanDatabase, seedTestUsers } from "@/tests/helpers/prisma-test-utils"
import { abortAllActiveExecutions } from "@/lib/mcp/mcp-execution-runtime"

const AUTO_PROTOTYPE_FLAG = "__AUTO_PROTOTYPE_DATA_DIR__"

beforeEach(async () => {
  // Abort any lingering background executions (heartbeat timers etc.) from a
  // prior test before truncating tables — prevents deadlocks with TRUNCATE.
  abortAllActiveExecutions("Test beforeEach: aborting prior test executions.")
  // Yield to let aborted async operations (in-flight Prisma calls) settle
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Clean PostgreSQL and seed default users for each test
  // cleanDatabase internally retries on transient errors
  await cleanDatabase()
  await seedTestUsers()

  // Legacy file-store temp dir (still needed for prototype-store.test.ts etc.)
  if (process.env.PROTOTYPE_DATA_DIR) {
    return
  }

  const autoDir = path.join(tmpdir(), `llm-pentest-vitest-${process.pid}`)

  if (!existsSync(autoDir)) {
    mkdirSync(autoDir, { recursive: true })
  }

  process.env.PROTOTYPE_DATA_DIR = autoDir
  process.env[AUTO_PROTOTYPE_FLAG] = "1"
})

afterEach(async () => {
  // Abort any in-flight MCP executions so the next test's cleanup is clean
  abortAllActiveExecutions("Test afterEach: aborting executions.")
  await new Promise((resolve) => setTimeout(resolve, 100))

  cleanup()

  if (process.env[AUTO_PROTOTYPE_FLAG] === "1" && process.env.PROTOTYPE_DATA_DIR) {
    rmSync(process.env.PROTOTYPE_DATA_DIR, { force: true, recursive: true })
    delete process.env.PROTOTYPE_DATA_DIR
    delete process.env[AUTO_PROTOTYPE_FLAG]
  }
})

if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
