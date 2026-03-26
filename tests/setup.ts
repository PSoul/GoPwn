import { existsSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"

const AUTO_PROTOTYPE_FLAG = "__AUTO_PROTOTYPE_DATA_DIR__"

beforeEach(() => {
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

afterEach(() => {
  cleanup()

  if (process.env[AUTO_PROTOTYPE_FLAG] === "1" && process.env.PROTOTYPE_DATA_DIR) {
    rmSync(process.env.PROTOTYPE_DATA_DIR, { force: true, recursive: true })
    delete process.env.PROTOTYPE_DATA_DIR
    delete process.env[AUTO_PROTOTYPE_FLAG]
  }
})

Object.defineProperty(window, "matchMedia", {
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
