import { describe, expect, it } from "vitest"

import { GET as getProjectContext } from "@/app/api/projects/[projectId]/context/route"
import { GET as getProjectFlow } from "@/app/api/projects/[projectId]/flow/route"
import { GET as getProjectOperations } from "@/app/api/projects/[projectId]/operations/route"
import { GET as getProjectDomains } from "@/app/api/projects/[projectId]/results/domains/route"
import { GET as getProjectFindings } from "@/app/api/projects/[projectId]/results/findings/route"
import { GET as getProjectNetwork } from "@/app/api/projects/[projectId]/results/network/route"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

describe("project surface api routes", () => {
  it("returns flow and operations payloads", async () => {
    const flowResponse = await getProjectFlow(new Request("http://localhost/api/projects/proj-huayao/flow"), buildProjectContext("proj-huayao"))
    const flowPayload = await flowResponse.json()

    expect(flowResponse.status).toBe(200)
    expect(flowPayload.detail.timeline.length).toBeGreaterThan(0)

    const operationsResponse = await getProjectOperations(
      new Request("http://localhost/api/projects/proj-huayao/operations"),
      buildProjectContext("proj-huayao"),
    )
    const operationsPayload = await operationsResponse.json()

    expect(operationsResponse.status).toBe(200)
    expect(operationsPayload.approvals.length).toBeGreaterThan(0)
    expect(operationsPayload.mcpRuns.length).toBeGreaterThan(0)
    expect(operationsPayload.detail.approvalControl.enabled).toBe(true)
  })

  it("returns result-table payloads for domains, network, and findings", async () => {
    const domainsResponse = await getProjectDomains(
      new Request("http://localhost/api/projects/proj-huayao/results/domains"),
      buildProjectContext("proj-huayao"),
    )
    const domainsPayload = await domainsResponse.json()

    expect(domainsResponse.status).toBe(200)
    expect(domainsPayload.group.title).toBe("域名 / Web 入口")

    const networkResponse = await getProjectNetwork(
      new Request("http://localhost/api/projects/proj-huayao/results/network"),
      buildProjectContext("proj-huayao"),
    )
    const networkPayload = await networkResponse.json()

    expect(networkResponse.status).toBe(200)
    expect(networkPayload.group.title).toBe("IP / 端口 / 服务")

    const findingsResponse = await getProjectFindings(
      new Request("http://localhost/api/projects/proj-huayao/results/findings"),
      buildProjectContext("proj-huayao"),
    )
    const findingsPayload = await findingsResponse.json()

    expect(findingsResponse.status).toBe(200)
    expect(findingsPayload.findings.length).toBeGreaterThan(0)
  })

  it("returns evidence-rich context payload", async () => {
    const response = await getProjectContext(new Request("http://localhost/api/projects/proj-huayao/context"), buildProjectContext("proj-huayao"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.assets.length).toBeGreaterThan(0)
    expect(payload.evidence.length).toBeGreaterThan(0)
    expect(payload.approvals.length).toBeGreaterThan(0)
  })
})
