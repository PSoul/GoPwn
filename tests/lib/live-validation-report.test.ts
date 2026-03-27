import { describe, expect, it } from "vitest"

import { buildLiveValidationArtifactBundle } from "../../scripts/lib/live-validation-report.mjs"

describe("live validation report bundle", () => {
  it("builds deterministic markdown and summary data for a real validation run", () => {
    const bundle = buildLiveValidationArtifactBundle({
      startedAt: "2026-03-27T08:00:00.000Z",
      finishedAt: "2026-03-27T08:04:30.000Z",
      project: {
        id: "proj-huayao",
        name: "华曜科技匿名外网面梳理",
      },
      lab: {
        id: "juice-shop",
        name: "OWASP Juice Shop",
        baseUrl: "http://127.0.0.1:3000",
      },
      provider: {
        provider: "openai-compatible",
        enabled: true,
        baseUrl: "https://api.siliconflow.cn/v1",
        orchestratorModel: "Pro/deepseek-ai/DeepSeek-V3.2",
      },
      validation: {
        status: "waiting_approval",
        planSummary: "先做 Web 入口识别，再进入一条受控高风险验证。",
        planItems: [
          {
            capability: "Web 页面探测类",
            requestedAction: "识别首页响应特征",
            target: "http://127.0.0.1:3000",
            riskLevel: "低",
          },
          {
            capability: "受控验证类",
            requestedAction: "尝试登录绕过验证",
            target: "http://127.0.0.1:3000/login",
            riskLevel: "高",
          },
        ],
        runs: [
          {
            capability: "Web 页面探测类",
            requestedAction: "识别首页响应特征",
            status: "已执行",
            connectorMode: "real",
            toolName: "web-surface-map",
            target: "http://127.0.0.1:3000",
          },
          {
            capability: "受控验证类",
            requestedAction: "尝试登录绕过验证",
            status: "待审批",
            connectorMode: "local",
            toolName: "auth-guard-check",
            target: "http://127.0.0.1:3000/login",
          },
        ],
        approval: {
          id: "APR-001",
          status: "待处理",
          actionType: "尝试登录绕过验证",
        },
      },
      context: {
        assetCount: 3,
        evidenceCount: 2,
        findingCount: 1,
      },
      mcp: {
        serverCount: 1,
        invocationCount: 1,
        invocations: [
          {
            serverName: "web-surface-stdio",
            toolName: "probe_web_surface",
            status: "succeeded",
            target: "http://127.0.0.1:3000",
          },
        ],
      },
    })

    expect(bundle.directoryName).toBe("2026-03-27T08-00-00-000Z-juice-shop")
    expect(bundle.summary.projectId).toBe("proj-huayao")
    expect(bundle.summary.validationStatus).toBe("waiting_approval")
    expect(bundle.summary.counts.assets).toBe(3)
    expect(bundle.summary.counts.realMcpInvocations).toBe(1)
    expect(bundle.markdown).toContain("# Real LLM / MCP / Local Lab Validation Report")
    expect(bundle.markdown).toContain("OWASP Juice Shop")
    expect(bundle.markdown).toContain("Web 页面探测类")
    expect(bundle.markdown).toContain("probe_web_surface")
    expect(bundle.markdown).toContain("待处理")
  })
})
