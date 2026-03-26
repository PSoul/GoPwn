import { describe, expect, it } from "vitest"

import { GET as getApprovals } from "@/app/api/approvals/route"
import { GET as getAssetDetail } from "@/app/api/assets/[assetId]/route"
import { GET as getAssets } from "@/app/api/assets/route"
import { GET as getDashboard } from "@/app/api/dashboard/route"
import { GET as getEvidenceDetail } from "@/app/api/evidence/[evidenceId]/route"
import { GET as getEvidence } from "@/app/api/evidence/route"

const buildAssetContext = (assetId: string) => ({
  params: Promise.resolve({ assetId }),
})

const buildEvidenceContext = (evidenceId: string) => ({
  params: Promise.resolve({ evidenceId }),
})

describe("operational surface api routes", () => {
  it("returns dashboard payload with metrics and queue data", async () => {
    const response = await getDashboard()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metrics.length).toBeGreaterThan(0)
    expect(payload.leadProject.name).toBe("华曜科技匿名外网面梳理")
    expect(payload.priorities.length).toBeGreaterThan(0)
  })

  it("returns approvals, assets, and evidence collections", async () => {
    const approvalsResponse = await getApprovals()
    const approvalsPayload = await approvalsResponse.json()

    expect(approvalsResponse.status).toBe(200)
    expect(approvalsPayload.total).toBeGreaterThan(0)

    const assetsResponse = await getAssets()
    const assetsPayload = await assetsResponse.json()

    expect(assetsResponse.status).toBe(200)
    expect(assetsPayload.total).toBeGreaterThan(0)

    const evidenceResponse = await getEvidence()
    const evidencePayload = await evidenceResponse.json()

    expect(evidenceResponse.status).toBe(200)
    expect(evidencePayload.total).toBeGreaterThan(0)
  })

  it("returns asset and evidence detail payloads plus 404s for unknown ids", async () => {
    const assetResponse = await getAssetDetail(new Request("http://localhost/api/assets/asset-443"), buildAssetContext("asset-443"))
    const assetPayload = await assetResponse.json()

    expect(assetResponse.status).toBe(200)
    expect(assetPayload.asset.id).toBe("asset-443")

    const evidenceResponse = await getEvidenceDetail(
      new Request("http://localhost/api/evidence/EV-20260326-010"),
      buildEvidenceContext("EV-20260326-010"),
    )
    const evidencePayload = await evidenceResponse.json()

    expect(evidenceResponse.status).toBe(200)
    expect(evidencePayload.record.id).toBe("EV-20260326-010")

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
