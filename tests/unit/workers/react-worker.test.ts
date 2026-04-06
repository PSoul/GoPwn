import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockProject, MOCK_REACT_FUNCTION_CALL, MOCK_REACT_FINAL_ANSWER } from "../../helpers/factories"

// ── vi.hoisted: 提升到模块顶部的 mock 引用 ──
const mockLlmChat = vi.hoisted(() => vi.fn())
const mockCallTool = vi.hoisted(() => vi.fn())

// ── Mock 所有外部依赖 ──
vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
  updateLifecycle: vi.fn().mockResolvedValue({}),
  updatePhaseAndRound: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/repositories/asset-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/repositories/finding-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "finding-new-001" }),
}))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "run-react-001" }),
  updateStatus: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findEnabled: vi.fn().mockResolvedValue([
    { id: "tool-001", toolName: "fscan_port_scan", description: "端口扫描", capability: "port_scanning", riskLevel: "low", inputSchema: { properties: { target: { type: "string" } } } },
  ]),
  findByToolName: vi.fn().mockResolvedValue({ id: "tool-001", toolName: "fscan_port_scan", capability: "port_scanning", riskLevel: "low", inputSchema: { properties: { target: { type: "string" } } } }),
}))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    orchestratorRound: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-001") }),
}))
vi.mock("@/lib/infra/abort-registry", () => ({
  registerAbort: vi.fn(),
  unregisterAbort: vi.fn(),
}))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 500 }),
  }),
}))

vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getLlmProvider: vi.fn().mockResolvedValue({ chat: mockLlmChat }),
  }
})

vi.mock("@/lib/llm/react-prompt", () => ({
  buildReactSystemPrompt: vi.fn().mockResolvedValue("你是一个渗透测试 AI 助手"),
}))

vi.mock("@/lib/llm/function-calling", () => ({
  mcpToolsToFunctions: vi.fn().mockReturnValue([
    { name: "fscan_port_scan", description: "端口扫描", parameters: { type: "object", properties: { target: { type: "string" } } } },
  ]),
  getControlFunctions: vi.fn().mockReturnValue([
    { name: "done", description: "结束当前轮次", parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } },
    { name: "report_finding", description: "报告发现", parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } },
  ]),
}))

vi.mock("@/lib/llm/tool-input-mapper", () => ({
  buildToolInputFromFunctionArgs: vi.fn().mockResolvedValue({ target: "127.0.0.1" }),
}))

vi.mock("@/lib/domain/scope-policy", () => ({
  createScopePolicy: vi.fn().mockReturnValue({
    isInScope: vi.fn().mockReturnValue(true),
    describe: vi.fn().mockReturnValue("127.0.0.1/24"),
  }),
}))

vi.mock("@/lib/mcp", () => ({
  callTool: (...args: unknown[]) => mockCallTool(...args),
}))

import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { createScopePolicy } from "@/lib/domain/scope-policy"
import { handleReactRound } from "@/lib/workers/react-worker"

describe("react-worker: handleReactRound", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("正常 function_call → MCP 执行 → LLM done 停止", async () => {
    // 第一步：LLM 调用工具
    mockLlmChat
      .mockResolvedValueOnce({
        ...MOCK_REACT_FUNCTION_CALL,
        toolCallId: "call_001",
      })
      // 第二步：LLM 调用 done 结束
      .mockResolvedValueOnce({
        content: null,
        functionCall: { name: "done", arguments: JSON.stringify({ summary: "扫描完成" }) },
        provider: "test-provider",
        model: "test-model",
        durationMs: 300,
        toolCallId: "call_002",
      })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "idle" }) as never,
    )
    mockCallTool.mockResolvedValue({ content: "PORT 80 open", isError: false })

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // 验证工具被调用
    expect(mockCallTool).toHaveBeenCalledTimes(1)

    // 验证 MCP run 创建和状态更新
    expect(mcpRunRepo.create).toHaveBeenCalled()
    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-react-001", "running", expect.anything())
    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith("run-react-001", "succeeded", expect.objectContaining({
      rawOutput: expect.stringContaining("PORT 80 open"),
    }))

    // 验证 round_completed 被发布
    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith(
      "round_completed",
      expect.objectContaining({ projectId: "proj-test-001", round: 1 }),
      expect.anything(),
    )
  })

  it("LLM 返回文本无 function_call → llm_no_action 停止", async () => {
    mockLlmChat.mockResolvedValueOnce({
      ...MOCK_REACT_FINAL_ANSWER,
    })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "executing" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // 没有工具调用
    expect(mockCallTool).not.toHaveBeenCalled()

    // 仍然应该发布 round_completed
    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith(
      "round_completed",
      expect.objectContaining({ projectId: "proj-test-001" }),
      expect.anything(),
    )
  })

  it("项目已 stopped → 跳过执行", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "stopped" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  it("项目已 stopping → 跳过执行", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "stopping" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })

  it("项目不存在 → 直接返回", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(null as never)

    await handleReactRound({ projectId: "proj-nonexist", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })

  it("MCP 工具执行失败 → 记录错误并继续循环", async () => {
    // 第一步：LLM 调用工具 → 失败
    mockLlmChat
      .mockResolvedValueOnce({
        ...MOCK_REACT_FUNCTION_CALL,
        toolCallId: "call_err_001",
      })
      // 第二步：LLM 调用 done
      .mockResolvedValueOnce({
        content: null,
        functionCall: { name: "done", arguments: JSON.stringify({ summary: "工具失败，结束" }) },
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        toolCallId: "call_err_002",
      })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "executing" }) as never,
    )
    mockCallTool.mockRejectedValueOnce(new Error("tool crashed"))

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // 工具失败应更新为 failed 状态
    expect(mcpRunRepo.updateStatus).toHaveBeenCalledWith(
      "run-react-001",
      "failed",
      expect.objectContaining({ error: expect.stringContaining("tool crashed") }),
    )
  })

  it("report_finding 控制函数 → 创建 finding", async () => {
    mockLlmChat
      .mockResolvedValueOnce({
        content: "发现了 SQL 注入",
        functionCall: {
          name: "report_finding",
          arguments: JSON.stringify({
            title: "SQL Injection in /login",
            severity: "high",
            target: "http://127.0.0.1:8080/login",
            detail: "参数 id 存在 SQL 注入",
          }),
        },
        provider: "test-provider",
        model: "test-model",
        durationMs: 400,
        toolCallId: "call_rf_001",
      })
      // 接着调用 done 结束
      .mockResolvedValueOnce({
        content: null,
        functionCall: { name: "done", arguments: JSON.stringify({ summary: "报告了一个发现" }) },
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        toolCallId: "call_rf_002",
      })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "executing" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // report_finding 不调用 MCP 工具
    expect(mockCallTool).not.toHaveBeenCalled()

    // 但应该创建 finding
    expect(findingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-test-001",
        title: "SQL Injection in /login",
        severity: "high",
      }),
    )
  })

  it("scope 超出 → 跳过执行但继续循环", async () => {
    // 模拟 scope 检查返回 false
    const scopeMock = createScopePolicy(["127.0.0.1"])
    vi.mocked(scopeMock.isInScope).mockReturnValue(false)

    mockLlmChat
      .mockResolvedValueOnce({
        content: "尝试扫描外部目标",
        functionCall: {
          name: "fscan_port_scan",
          arguments: JSON.stringify({ target: "10.0.0.1" }),
        },
        provider: "test-provider",
        model: "test-model",
        durationMs: 300,
        toolCallId: "call_scope_001",
      })
      .mockResolvedValueOnce({
        content: null,
        functionCall: { name: "done", arguments: JSON.stringify({ summary: "结束" }) },
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        toolCallId: "call_scope_002",
      })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "executing" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // scope 超出时不执行 MCP 工具
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  it("非法 JSON 参数 → 降级处理不崩溃", async () => {
    mockLlmChat
      .mockResolvedValueOnce({
        content: "扫描目标",
        functionCall: {
          name: "fscan_port_scan",
          arguments: "这不是JSON{{{",  // 非法 JSON
        },
        provider: "test-provider",
        model: "test-model",
        durationMs: 300,
        toolCallId: "call_bad_json_001",
      })
      .mockResolvedValueOnce({
        content: null,
        functionCall: { name: "done", arguments: JSON.stringify({ summary: "结束" }) },
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        toolCallId: "call_bad_json_002",
      })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "executing" }) as never,
    )
    mockCallTool.mockResolvedValue({ content: "result", isError: false })

    // 不应该抛错
    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    // 即使 JSON 解析失败，工具仍然应该被调用（使用空 fnArgs）
    expect(mockCallTool).toHaveBeenCalled()
  })

  it("failed 状态通过 RETRY_REACT 转为 executing", async () => {
    mockLlmChat.mockResolvedValueOnce({
      content: null,
      functionCall: { name: "done", arguments: JSON.stringify({ summary: "重试完成" }) },
      provider: "test-provider",
      model: "test-model",
      durationMs: 200,
      toolCallId: "call_retry_001",
    })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "failed" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 2 })

    // 应该从 failed 状态通过 RETRY_REACT 转换
    expect(projectRepo.updateLifecycle).toHaveBeenCalledWith("proj-test-001", "executing")
  })

  it("reviewing 状态通过 CONTINUE_REACT 转为 executing", async () => {
    mockLlmChat.mockResolvedValueOnce({
      content: null,
      functionCall: { name: "done", arguments: JSON.stringify({ summary: "继续完成" }) },
      provider: "test-provider",
      model: "test-model",
      durationMs: 200,
      toolCallId: "call_continue_001",
    })

    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "reviewing" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 3 })

    // 应该从 reviewing 状态通过 CONTINUE_REACT 转换
    expect(projectRepo.updateLifecycle).toHaveBeenCalledWith("proj-test-001", "executing")
  })

  it("不可启动的状态（如 completed）→ 跳过", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(
      mockProject({ lifecycle: "completed" }) as never,
    )

    await handleReactRound({ projectId: "proj-test-001", round: 1 })

    expect(mockLlmChat).not.toHaveBeenCalled()
  })
})
