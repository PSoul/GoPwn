import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/llm/system-prompt", () => ({
  loadSystemPrompt: vi.fn().mockResolvedValue("你是安全评估AI"),
}))

import {
  buildAnalyzerPrompt,
  buildReviewerPrompt,
  buildVerifierPrompt,
  parseLlmJson,
} from "@/lib/llm/prompts"

describe("prompts: buildAnalyzerPrompt", () => {
  it("返回 system + user 消息，包含 toolName 和 rawOutput", async () => {
    const messages = await buildAnalyzerPrompt({
      projectName: "测试项目",
      toolName: "nmap_scan",
      target: "192.168.1.1",
      rawOutput: "PORT   STATE SERVICE\n80/tcp open  http",
      existingAssets: [{ kind: "ip", value: "192.168.1.1" }],
      existingFindings: [
        { title: "弱口令", severity: "high", affectedTarget: "192.168.1.1" },
      ],
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].role).toBe("user")
    expect(messages[1].content).toContain("nmap_scan")
    expect(messages[1].content).toContain("80/tcp open  http")
  })
})

describe("prompts: buildReviewerPrompt", () => {
  it("返回 user content 包含 roundSummary 和 phase", async () => {
    const messages = await buildReviewerPrompt({
      projectName: "测试项目",
      currentPhase: "assessment",
      round: 2,
      maxRounds: 5,
      roundSummary: "完成了端口扫描和服务识别",
      totalAssets: 10,
      totalFindings: 3,
      unverifiedFindings: 2,
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].role).toBe("user")
    expect(messages[1].content).toContain("完成了端口扫描和服务识别")
    expect(messages[1].content).toContain("assessment")
    expect(messages[1].content).toContain("漏洞评估")
  })
})

describe("prompts: buildVerifierPrompt", () => {
  it("返回 user content 包含 finding.title", async () => {
    const messages = await buildVerifierPrompt({
      projectName: "测试项目",
      finding: {
        title: "SQL 注入",
        summary: "发现 SQL 注入漏洞",
        severity: "critical",
        affectedTarget: "http://target/login",
      },
      evidence: {
        rawOutput: "sqlmap output...",
        toolName: "sqlmap",
      },
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].role).toBe("user")
    expect(messages[1].content).toContain("SQL 注入")
    expect(messages[1].content).toContain("sqlmap")
  })
})

describe("prompts: parseLlmJson", () => {
  it("正常 JSON + markdown fence → 解析成功", () => {
    const result = parseLlmJson<{ a: number }>('```json\n{"a":1}\n```')
    expect(result).toEqual({ a: 1 })
  })

  it("非法 JSON → throw 包含 解析失败", () => {
    expect(() => parseLlmJson("not json at all")).toThrow(/解析失败/)
  })
})
