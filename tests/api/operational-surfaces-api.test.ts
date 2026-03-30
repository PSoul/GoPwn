import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getApprovals } from "@/app/api/approvals/route"
import { GET as getAssetDetail } from "@/app/api/assets/[assetId]/route"
import { GET as getAssets } from "@/app/api/assets/route"
import { GET as getDashboard } from "@/app/api/dashboard/route"
import { GET as getEvidenceDetail } from "@/app/api/evidence/[evidenceId]/route"
import { GET as getEvidence } from "@/app/api/evidence/route"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

const buildAssetContext = (assetId: string) => ({
  params: Promise.resolve({ assetId }),
})

const buildEvidenceContext = (evidenceId: string) => ({
  params: Promise.resolve({ evidenceId }),
})

describe("operational surface api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-operational-store-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("returns dashboard payload with metrics and queue data", async () => {
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })
    const response = await getDashboard(
      new Request("http://localhost/api/dashboard"),
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metrics.length).toBeGreaterThan(0)
    expect(payload.leadProject.name).toBe(fixture.project.name)
    expect(payload.priorities.length).toBeGreaterThan(0)
  })

  it("returns approvals, assets, and evidence collections", async () => {
    await createWorkflowFixture({ workflow: "with-approval" })
    const approvalsResponse = await getApprovals(
      new Request("http://localhost/api/approvals"),
      { params: Promise.resolve({}) },
    )
    const approvalsPayload = await approvalsResponse.json()

    expect(approvalsResponse.status).toBe(200)
    expect(approvalsPayload.total).toBeGreaterThan(0)

    const assetsResponse = await getAssets(
      new Request("http://localhost/api/assets"),
      { params: Promise.resolve({}) },
    )
    const assetsPayload = await assetsResponse.json()

    expect(assetsResponse.status).toBe(200)
    expect(assetsPayload.total).toBeGreaterThan(0)

    const evidenceResponse = await getEvidence(
      new Request("http://localhost/api/evidence"),
      { params: Promise.resolve({}) },
    )
    const evidencePayload = await evidenceResponse.json()

    expect(evidenceResponse.status).toBe(200)
    expect(evidencePayload.total).toBeGreaterThan(0)
  })

  it("returns asset and evidence detail payloads plus 404s for unknown ids", async () => {
    const fixture = await createWorkflowFixture({ workflow: "with-approval" })
    const assetResponse = await getAssetDetail(
      new Request(`http://localhost/api/assets/${fixture.assets[0].id}`),
      buildAssetContext(fixture.assets[0].id),
    )
    const assetPayload = await assetResponse.json()

    expect(assetResponse.status).toBe(200)
    expect(assetPayload.asset.id).toBe(fixture.assets[0].id)

    const evidenceResponse = await getEvidenceDetail(
      new Request(`http://localhost/api/evidence/${fixture.evidence[0].id}`),
      buildEvidenceContext(fixture.evidence[0].id),
    )
    const evidencePayload = await evidenceResponse.json()

    expect(evidenceResponse.status).toBe(200)
    expect(evidencePayload.record.id).toBe(fixture.evidence[0].id)

    const missingAssetResponse = await getAssetDetail(new Request("http://localhost/api/assets/missing"), buildAssetContext("missing"))
    const missingAssetPayload = await missingAssetResponse.json()

    expect(missingAssetResponse.status).toBe(404)
    expect(missingAssetPayload.error).toContain("missing")

    const missingEvidenceResponse = await getEvidenceDetail(
      new Request("http://localhost/api/evidence/missing"),
      buildEvidenceContext("missing"),
    )
    const missingEvidencePayload = await missingEvidenceResponse.json()

    expect(missingEvidenceResponse.status).toBe(404)
    expect(missingEvidencePayload.error).toContain("missing")
  })
})
