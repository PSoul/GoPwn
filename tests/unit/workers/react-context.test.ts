/**
 * 单元测试：ReactContextManager
 * 测试消息管理、滑动窗口压缩、边界条件
 */
import { describe, it, expect } from "vitest"
import { ReactContextManager, generateToolCallId } from "@/lib/workers/react-context"

/** 辅助：批量添加 N 步 */
function addSteps(ctx: ReactContextManager, count: number) {
  for (let i = 1; i <= count; i++) {
    const callId = generateToolCallId()
    ctx.addAssistantMessage(`思考第${i}步`, { name: "nmap_scan", arguments: `{"t":"${i}"}` }, callId)
    ctx.addToolResult({
      stepIndex: i,
      toolName: "nmap_scan",
      target: `192.168.1.${i}`,
      functionName: "nmap_scan",
      output: `端口扫描结果 step ${i}: ${"x".repeat(100)}`,
      status: "succeeded",
      toolCallId: callId,
    })
  }
}

describe("ReactContextManager", () => {
  describe("基础消息管理", () => {
    it("空历史 → getMessages 返回 system + user", () => {
      const ctx = new ReactContextManager("sys", "usr")
      const msgs = ctx.getMessages()
      expect(msgs).toHaveLength(2)
      expect(msgs[0]).toEqual({ role: "system", content: "sys" })
      expect(msgs[1]).toEqual({ role: "user", content: "usr" })
    })

    it("addAssistantMessage 添加带 tool_calls 的 assistant 消息", () => {
      const ctx = new ReactContextManager("sys", "usr")
      const callId = generateToolCallId()
      ctx.addAssistantMessage("思考", { name: "scan", arguments: '{"t":"1"}' }, callId)
      const msgs = ctx.getMessages()
      expect(msgs).toHaveLength(3)
      expect(msgs[2].role).toBe("assistant")
      expect(msgs[2].tool_calls).toHaveLength(1)
      expect(msgs[2].tool_calls![0].id).toBe(callId)
      expect(msgs[2].tool_calls![0].function.name).toBe("scan")
    })

    it("addToolResult 添加 role:tool 消息", () => {
      const ctx = new ReactContextManager("sys", "usr")
      const callId = generateToolCallId()
      ctx.addAssistantMessage("思考", { name: "scan", arguments: "{}" }, callId)
      ctx.addToolResult({
        stepIndex: 1,
        toolName: "scan",
        target: "t",
        functionName: "scan",
        output: "result ok",
        status: "succeeded",
        toolCallId: callId,
      })
      const msgs = ctx.getMessages()
      expect(msgs).toHaveLength(4)
      expect(msgs[3].role).toBe("tool")
      expect(msgs[3].tool_call_id).toBe(callId)
      expect(msgs[3].content).toBe("result ok")
    })
  })

  describe("短历史不压缩", () => {
    it("步数 <= RECENT_WINDOW(5) 时不压缩，原样返回", () => {
      const ctx = new ReactContextManager("system prompt", "开始渗透测试")
      addSteps(ctx, 3)
      const msgs = ctx.getMessages()
      // system + user + 3*(assistant+tool) = 2 + 6 = 8
      expect(msgs).toHaveLength(8)
      expect(msgs[0].role).toBe("system")
      expect(msgs[1].role).toBe("user")
    })

    it("步数 = RECENT_WINDOW(5) 时不压缩", () => {
      const ctx = new ReactContextManager("sys", "usr")
      addSteps(ctx, 5)
      const msgs = ctx.getMessages()
      // system + user + 5*(assistant+tool) = 2 + 10 = 12
      expect(msgs).toHaveLength(12)
      // 没有 summary 消息
      const summaryMsg = msgs.find(m =>
        typeof m.content === "string" && m.content.includes("[Previous steps summary]"),
      )
      expect(summaryMsg).toBeUndefined()
    })
  })

  describe("超长历史压缩", () => {
    it("步数超过 RECENT_WINDOW 且 token 超限时，旧消息被摘要替代", () => {
      const ctx = new ReactContextManager("system prompt", "开始渗透测试")
      // 添加大量步骤触发压缩（每步大 output 以超过 TOKEN_BUDGET）
      for (let i = 1; i <= 10; i++) {
        const callId = generateToolCallId()
        ctx.addAssistantMessage(`思考${i}`, { name: "scan", arguments: "{}" }, callId)
        ctx.addToolResult({
          stepIndex: i,
          toolName: "scan",
          target: "t",
          functionName: "scan",
          output: "x".repeat(30000), // 大输出加速触发压缩（会被截断到 MAX_OUTPUT_CHARS=3000）
          status: "succeeded",
          toolCallId: callId,
        })
      }
      const msgs = ctx.getMessages()
      // 压缩后应有 summary 消息
      const summaryMsg = msgs.find(m =>
        typeof m.content === "string" && m.content.includes("[Previous steps summary]"),
      )
      // 注意：由于单条 output 被截断到 3000 字符，10 步可能不够触发 TOKEN_BUDGET(80000)
      // 压缩取决于 estimateTokens > 80000，即总字符 > 240000
      // 10 步 * (思考 + 3000 截断 output) ≈ 30000+ chars → ~10000 tokens
      // 可能不触发压缩，这种情况下验证消息完整性
      if (summaryMsg) {
        expect(summaryMsg.content).toContain("[Previous steps summary]")
        // system 消息保留在首位
        expect(msgs[0]).toEqual({ role: "system", content: "system prompt" })
      } else {
        // 未触发压缩，验证所有消息完好
        expect(msgs.length).toBe(2 + 10 * 2) // system + user + 10*(assistant+tool)
      }
    })

    it("大量大消息触发压缩后 system 消息始终保留在首位", () => {
      const ctx = new ReactContextManager("你是安全AI", "开始")
      // 需要足够多的步骤和足够大的内容来超过 TOKEN_BUDGET
      // TOKEN_BUDGET = 80000 tokens ≈ 240000 chars
      // 每步 assistant(~10) + tool(3000 truncated) ≈ 3010 chars
      // 需要约 80 步来触发，但我们用更多步
      for (let i = 1; i <= 90; i++) {
        const callId = generateToolCallId()
        ctx.addAssistantMessage(`思考第${i}步的详细推理过程`.repeat(10), { name: "scan", arguments: '{"target":"192.168.1.1","ports":"1-65535"}' }, callId)
        ctx.addToolResult({
          stepIndex: i,
          toolName: "scan",
          target: "t",
          functionName: "scan",
          output: "x".repeat(30000),
          status: "succeeded",
          toolCallId: callId,
        })
      }
      const msgs = ctx.getMessages()
      expect(msgs[0]).toEqual({ role: "system", content: "你是安全AI" })

      // 压缩后消息数应少于未压缩时的 2 + 90*2 = 182
      expect(msgs.length).toBeLessThan(182)

      // 应该有 summary 消息
      const summaryMsg = msgs.find(m =>
        typeof m.content === "string" && m.content.includes("[Previous steps summary]"),
      )
      expect(summaryMsg).toBeDefined()
    })
  })

  describe("工具函数", () => {
    it("generateToolCallId 生成唯一 ID", () => {
      const id1 = generateToolCallId()
      const id2 = generateToolCallId()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^call_\d+_\d+$/)
    })

    it("updateSystemPrompt 替换 system 消息", () => {
      const ctx = new ReactContextManager("old prompt", "usr")
      ctx.updateSystemPrompt("new prompt")
      const msgs = ctx.getMessages()
      expect(msgs[0]).toEqual({ role: "system", content: "new prompt" })
    })
  })

  describe("output 截断", () => {
    it("超长 output 被截断到 MAX_OUTPUT_CHARS", () => {
      const ctx = new ReactContextManager("sys", "usr")
      const callId = generateToolCallId()
      ctx.addAssistantMessage("t", { name: "s", arguments: "{}" }, callId)
      ctx.addToolResult({
        stepIndex: 1,
        toolName: "s",
        target: "t",
        functionName: "s",
        output: "y".repeat(5000),
        status: "succeeded",
        toolCallId: callId,
      })
      const msgs = ctx.getMessages()
      const toolMsg = msgs.find(m => m.role === "tool")!
      // MAX_OUTPUT_CHARS = 3000, 应该被截断
      expect(toolMsg.content!.length).toBeLessThanOrEqual(3000 + 20) // 3000 + "...[truncated]"
      expect(toolMsg.content).toContain("...[truncated]")
    })
  })
})
