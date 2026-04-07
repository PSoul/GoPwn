import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/llm/system-prompt", () => ({
  loadSystemPrompt: vi.fn().mockResolvedValue("你是安全评估AI"),
}))

import { buildReactSystemPrompt, type ReactContext } from "@/lib/llm/react-prompt"

function makeCtx(overrides: Partial<ReactContext> = {}): ReactContext {
  return {
    projectName: "测试项目",
    targets: [{ value: "192.168.1.1", type: "ip" }],
    currentPhase: "recon",
    round: 1,
    maxRounds: 5,
    maxSteps: 10,
    stepIndex: 0,
    scopeDescription: "仅测试内网",
    assets: [{ kind: "ip", value: "192.168.1.1", label: "主机" }],
    findings: [
      {
        title: "弱口令",
        severity: "high",
        affectedTarget: "192.168.1.1",
        status: "unverified",
      },
    ],
    availableTools: [{ name: "nmap_scan", description: "端口扫描" }],
    ...overrides,
  }
}

describe("react-prompt: buildReactSystemPrompt", () => {
  it("基本构建 — 包含项目名、阶段名、目标列表", async () => {
    const prompt = await buildReactSystemPrompt(makeCtx())

    expect(prompt).toContain("测试项目")
    expect(prompt).toContain("信息收集")
    expect(prompt).toContain("192.168.1.1")
  })

  it("工具列表注入 — 包含工具名和描述", async () => {
    const prompt = await buildReactSystemPrompt(makeCtx())

    expect(prompt).toContain("**nmap_scan**")
    expect(prompt).toContain("端口扫描")
    expect(prompt).toContain("可用工具")
  })

  it("无工具场景 — 不崩溃，不包含可用工具段落", async () => {
    const prompt = await buildReactSystemPrompt(makeCtx({ availableTools: [] }))

    expect(prompt).not.toContain("可用工具")
  })

  it("阶段上下文 — 包含 assessment 阶段标签", async () => {
    const prompt = await buildReactSystemPrompt(
      makeCtx({ currentPhase: "assessment" }),
    )

    expect(prompt).toContain("漏洞评估")
    expect(prompt).toContain("assessment")
  })

  it("空资产/发现 — 包含尚无提示", async () => {
    const prompt = await buildReactSystemPrompt(
      makeCtx({ assets: [], findings: [] }),
    )

    expect(prompt).toContain("尚无已发现资产")
    expect(prompt).toContain("尚无发现")
  })
})
