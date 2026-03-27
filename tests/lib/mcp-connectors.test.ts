import { afterEach, describe, expect, it } from "vitest"

import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import {
  realDnsIntelligenceConnector,
  resetRealDnsConnectorTestAdapters,
  setRealDnsConnectorTestAdapters,
} from "@/lib/mcp-connectors/real-dns-intelligence-connector"
import { getProjectById, mcpTools } from "@/lib/prototype-data"
import type { McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"
import type { McpRunRecord } from "@/lib/prototype-types"

const REAL_DNS_TEST_FLAG = "ENABLE_REAL_DNS_CONNECTOR_IN_TESTS"
const initialRealDnsTestFlag = process.env[REAL_DNS_TEST_FLAG]

function buildDnsContext(target: string): McpConnectorExecutionContext {
  const project = getProjectById("proj-huayao")
  const tool = mcpTools.find((item) => item.toolName === "dns-census")

  if (!project || !tool) {
    throw new Error("Missing seeded project/tool context for connector tests.")
  }

  const run: McpRunRecord = {
    id: "run-test-dns",
    projectId: project.id,
    projectName: project.name,
    capability: tool.capability,
    toolId: tool.id,
    toolName: tool.toolName,
    requestedAction: "补采证书与子域情报",
    target,
    riskLevel: "低",
    boundary: "外部目标交互",
    dispatchMode: "自动执行",
    status: "执行中",
    requestedBy: "test",
    createdAt: "2026-03-26 22:00",
    updatedAt: "2026-03-26 22:00",
    summaryLines: [],
  }

  return {
    approval: null,
    priorOutputs: {},
    project,
    run,
    tool,
  }
}

describe("MCP connector registry", () => {
  afterEach(() => {
    resetRealDnsConnectorTestAdapters()

    if (initialRealDnsTestFlag === undefined) {
      delete process.env[REAL_DNS_TEST_FLAG]
      return
    }

    process.env[REAL_DNS_TEST_FLAG] = initialRealDnsTestFlag
  })

  it("defaults to the local DNS connector for hostname targets during automated tests", () => {
    const connector = resolveMcpConnector(buildDnsContext("admin.huayao.com"))

    expect(connector?.key).toBe("local-dns-census")
    expect(connector?.mode).toBe("local")
  })

  it("can re-enable the real DNS connector during automated tests when explicitly requested", () => {
    process.env[REAL_DNS_TEST_FLAG] = "1"

    const connector = resolveMcpConnector(buildDnsContext("admin.huayao.com"))

    expect(connector?.key).toBe("real-dns-intelligence")
    expect(connector?.mode).toBe("real")
  })

  it("falls back to the local DNS connector for CIDR targets", () => {
    const connector = resolveMcpConnector(buildDnsContext("203.107.18.0/24"))

    expect(connector?.key).toBe("local-dns-census")
    expect(connector?.mode).toBe("local")
  })

  it("returns normalized real DNS intelligence with mocked Node adapters", async () => {
    setRealDnsConnectorTestAdapters({
      probeCertificate: async () => ({
        fingerprint256: "AA:BB:CC:DD",
        subject: { CN: "admin.huayao.com" },
        issuer: { CN: "Huayao Test CA" },
        subjectaltname: "DNS:admin.huayao.com, DNS:assets.huayao.com",
        valid_from: "Mar 25 00:00:00 2026 GMT",
        valid_to: "Apr 25 00:00:00 2026 GMT",
      }),
      resolve4: async () => ["198.51.100.10"],
      resolve6: async () => ["2001:db8::10"],
      resolveMx: async () => [{ exchange: "mx.huayao.com", priority: 10 }],
      resolveNs: async () => ["ns1.huayao.com"],
      resolveTxt: async () => [["v=spf1 include:mail.huayao.com -all"]],
      reverse: async () => ["admin.huayao.com"],
    })

    const result = await realDnsIntelligenceConnector.execute(buildDnsContext("admin.huayao.com"))

    expect(result.status).toBe("succeeded")

    const successResult = result as Extract<McpConnectorResult, { status: "succeeded" }>
    expect(successResult.mode).toBe("real")
    expect(successResult.outputs.discoveredSubdomains).toContain("admin.huayao.com")
    expect(successResult.outputs.discoveredSubdomains).toContain("assets.huayao.com")
    expect(successResult.rawOutput.some((line) => line.includes("A admin.huayao.com"))).toBe(true)
    expect(successResult.structuredContent.resolvedAddresses).toEqual(["198.51.100.10", "2001:db8::10"])
    expect(successResult.structuredContent.certificate).toMatchObject({
      fingerprint256: "AA:BB:CC:DD",
    })
  })
})
