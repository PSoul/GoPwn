import { afterEach, describe, expect, it } from "vitest"

import { createExecutionAbortError } from "@/lib/mcp/mcp-execution-abort"
import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import {
  realDnsIntelligenceConnector,
  resetRealDnsConnectorTestAdapters,
  setRealDnsConnectorTestAdapters,
} from "@/lib/mcp-connectors/real-dns-intelligence-connector"
import type { McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"
import type { McpRunRecord, McpToolRecord, ProjectRecord } from "@/lib/prototype-types"

const REAL_DNS_TEST_FLAG = "ENABLE_REAL_DNS_CONNECTOR_IN_TESTS"
const initialRealDnsTestFlag = process.env[REAL_DNS_TEST_FLAG]

const projectFixture: ProjectRecord = {
  id: "proj-test-dns",
  code: "TEST-DNS",
  name: "DNS 测试项目",
  targetInput: "example.com",
  targets: ["example.com"],
  description: "",
  stage: "授权与范围定义",
  status: "运行中",
  pendingApprovals: 0,
  openTasks: 0,
  assetCount: 0,
  evidenceCount: 0,
  riskSummary: "",
  summary: "",
  lastActor: "test",
  createdAt: "2026-03-26 22:00",
  lastUpdated: "2026-03-26 22:00",
}

const toolFixture: McpToolRecord = {
  id: "tool-dns-census",
  capability: "DNS / 子域 / 证书情报类",
  toolName: "dns-census",
  version: "1.0",
  riskLevel: "低",
  status: "启用",
  category: "侦察",
  description: "被动域名情报",
  inputMode: "目标域名",
  outputMode: "JSON",
  boundary: "外部目标交互",
  requiresApproval: false,
  endpoint: "",
  owner: "平台内置",
  defaultConcurrency: "1",
  rateLimit: "",
  timeout: "30s",
  retry: "1",
  lastCheck: "",
  notes: "",
}

function buildDnsContext(target: string): McpConnectorExecutionContext {
  const run: McpRunRecord = {
    id: "run-test-dns",
    projectId: projectFixture.id,
    projectName: projectFixture.name,
    capability: toolFixture.capability,
    toolId: toolFixture.id,
    toolName: toolFixture.toolName,
    requestedAction: "采集证书与子域情报",
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
    project: projectFixture,
    run,
    tool: toolFixture,
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

  it("defaults to the local DNS connector for hostname targets during automated tests", async () => {
    const connector = await resolveMcpConnector(buildDnsContext("admin.huayao.com"))

    expect(connector?.key).toBe("local-dns-census")
    expect(connector?.mode).toBe("local")
  })

  it("can re-enable the real DNS connector during automated tests when explicitly requested", async () => {
    process.env[REAL_DNS_TEST_FLAG] = "1"

    const connector = await resolveMcpConnector(buildDnsContext("admin.huayao.com"))

    expect(connector?.key).toBe("real-dns-intelligence")
    expect(connector?.mode).toBe("real")
  })

  it("falls back to the local DNS connector for CIDR targets", async () => {
    const connector = await resolveMcpConnector(buildDnsContext("203.107.18.0/24"))

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

  it("stops local foundational connectors immediately when the execution signal is already aborted", async () => {
    const connector = await resolveMcpConnector(buildDnsContext("admin.huayao.com"))
    const controller = new AbortController()

    controller.abort("研究员请求停止当前运行中的任务。")

    await expect(
      Promise.resolve().then(() =>
        connector!.execute({
          ...buildDnsContext("admin.huayao.com"),
          signal: controller.signal,
        } as McpConnectorExecutionContext),
      ),
    ).rejects.toMatchObject({
      name: "AbortError",
    })
  })

  it("aborts real DNS collection checkpoints without waiting for the slow adapter to finish", async () => {
    process.env[REAL_DNS_TEST_FLAG] = "1"
    let cancelledBySignal = false

    setRealDnsConnectorTestAdapters({
      probeCertificate: async () => null,
      resolve4: (_host, signal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(["198.51.100.10"]), 4_000)

          signal?.addEventListener(
            "abort",
            () => {
              cancelledBySignal = true
              clearTimeout(timer)
              reject(createExecutionAbortError(signal.reason))
            },
            { once: true },
          )
        }),
      resolve6: async () => [],
      resolveMx: async () => [],
      resolveNs: async () => [],
      resolveTxt: async () => [],
      reverse: async () => [],
    })

    const controller = new AbortController()
    const startedAt = Date.now()
    const executionPromise = realDnsIntelligenceConnector.execute({
      ...buildDnsContext("admin.huayao.com"),
      signal: controller.signal,
    } as McpConnectorExecutionContext)

    setTimeout(() => controller.abort("研究员请求停止当前运行中的任务。"), 120)

    await expect(executionPromise).rejects.toMatchObject({
      name: "AbortError",
    })
    expect(cancelledBySignal).toBe(true)
    expect(Date.now() - startedAt).toBeLessThan(1_500)
  })
})
