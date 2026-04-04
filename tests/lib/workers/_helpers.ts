import { vi } from "vitest"

/** 创建 mock project */
export function mockProject(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "proj-test-001",
    code: "proj-20260405-abc",
    name: "Test Project",
    description: "",
    lifecycle: "planning",
    currentPhase: "recon",
    currentRound: 0,
    maxRounds: 10,
    targets: [{ value: "http://127.0.0.1:8080", type: "url", normalized: "http://127.0.0.1:8080" }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 创建 mock McpRun */
export function mockMcpRun(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "run-test-001",
    projectId: "proj-test-001",
    toolName: "fscan_port_scan",
    target: "127.0.0.1",
    requestedAction: "扫描目标端口",
    capability: "port_scanning",
    riskLevel: "low",
    status: "scheduled",
    phase: "recon",
    round: 1,
    rawOutput: null,
    error: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 创建 mock LLM provider */
export function mockLlmProvider(response: string) {
  return {
    chat: vi.fn().mockResolvedValue({
      content: response,
      provider: "test-provider",
      model: "test-model",
      durationMs: 1000,
    }),
  }
}

/** 创建 mock Finding */
export function mockFinding(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "finding-test-001",
    projectId: "proj-test-001",
    evidenceId: "evidence-001",
    status: "suspected",
    severity: "high",
    title: "SQL Injection",
    summary: "Found SQL injection in login form",
    affectedTarget: "http://127.0.0.1:8080/login",
    recommendation: "Use parameterized queries",
    evidence: {
      rawOutput: "HTTP/1.1 200 OK\nerror in SQL syntax",
      toolName: "curl_http_request",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 标准 mock LLM plan 响应 */
export const MOCK_PLAN_RESPONSE = JSON.stringify({
  summary: "执行端口扫描和服务探测",
  phase: "recon",
  items: [
    {
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
      action: "扫描常见端口",
      rationale: "首轮信息收集",
      phase: "recon",
      riskLevel: "low",
    },
  ],
})

/** 标准 mock LLM analysis 响应 */
export const MOCK_ANALYSIS_RESPONSE = JSON.stringify({
  assets: [
    { kind: "port", value: "127.0.0.1:80", label: "HTTP (80)", fingerprints: [] },
  ],
  findings: [
    {
      title: "Open HTTP Port",
      summary: "Port 80 is open with nginx",
      severity: "info",
      affectedTarget: "127.0.0.1:80",
      recommendation: "Review exposed services",
    },
  ],
  evidenceSummary: "Found 1 open port with nginx web server",
})

/** 标准 mock LLM review 响应 */
export const MOCK_REVIEW_RESPONSE = JSON.stringify({
  decision: "continue",
  nextPhase: "discovery",
  reasoning: "第一轮已完成信息收集，继续进入发现阶段",
})
