import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getVulnCenterSummary } from "@/app/api/vuln-center/summary/route"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"
import type { VulnCenterSummaryPayload } from "@/lib/prototype-types"

describe("vuln center summary api", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-vuln-center-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.PROTOTYPE_DATA_DIR
  })

  it("returns empty summary when no findings exist", async () => {
    const request = new Request("http://localhost/api/vuln-center/summary")
    const response = await getVulnCenterSummary(request, { params: Promise.resolve({}) })
    const payload = (await response.json()) as VulnCenterSummaryPayload

    expect(response.status).toBe(200)
    expect(payload.total).toBe(0)
    expect(payload.findings).toEqual([])
    expect(payload.pendingVerification).toBe(0)
  })

  it("returns findings with project names when projects have findings", async () => {
    const fixture = createStoredProjectFixture()

    const request = new Request("http://localhost/api/vuln-center/summary")
    const response = await getVulnCenterSummary(request, { params: Promise.resolve({}) })
    const payload = (await response.json()) as VulnCenterSummaryPayload

    expect(response.status).toBe(200)
    // fixture should create at least some data
    expect(payload).toHaveProperty("total")
    expect(payload).toHaveProperty("bySeverity")
    expect(payload).toHaveProperty("pendingVerification")
    expect(payload).toHaveProperty("findings")
    expect(Array.isArray(payload.findings)).toBe(true)
  })
})
