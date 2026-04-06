import { vi } from "vitest"

// ─── Project ────────────────────────────────────────────

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

// ─── MCP Run ────────────────────────────────────────────

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

// ─── Finding ────────────────────────────────────────────

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

// ─── Approval ───────────────────────────────────────────

export function mockApproval(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "approval-test-001",
    projectId: "proj-test-001",
    mcpRunId: "run-test-001",
    target: "127.0.0.1",
    actionType: "port_scan",
    riskLevel: "medium",
    rationale: "需要扫描目标端口",
    status: "pending",
    decidedAt: null,
    decisionNote: "",
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── Asset ──────────────────────────────────────────────

export function mockAsset(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "asset-test-001",
    projectId: "proj-test-001",
    parentId: null,
    kind: "port",
    value: "127.0.0.1:80",
    label: "HTTP (80)",
    confidence: 0.9,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    metadata: {},
    ...overrides,
  }
}

// ─── Evidence ───────────────────────────────────────────

export function mockEvidence(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "evidence-test-001",
    projectId: "proj-test-001",
    assetId: null,
    mcpRunId: "run-test-001",
    title: "Port scan result",
    toolName: "fscan_port_scan",
    rawOutput: "PORT STATE SERVICE\n80/tcp open http",
    summary: "Found open HTTP port",
    artifactPaths: [],
    capturedUrl: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── LLM Log ────────────────────────────────────────────

export function mockLlmLog(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "llmlog-test-001",
    projectId: "proj-test-001",
    role: "planner",
    phase: "planning",
    prompt: "[system] You are a penetration testing planner...",
    response: "",
    status: "streaming",
    model: "",
    provider: "openai-compatible",
    durationMs: null,
    error: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── Audit Event ────────────────────────────────────────

export function mockAuditEntry(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "audit-test-001",
    projectId: "proj-test-001",
    category: "project",
    action: "created",
    actor: "user",
    detail: "Created test project",
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── User ───────────────────────────────────────────────

export function mockUser(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "user-test-001",
    account: "researcher",
    password: "$2b$10$dummyhashfortest", // bcrypt placeholder
    displayName: "Test Researcher",
    role: "researcher",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── LLM Provider Mock ─────────────────────────────────

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

// ─── Preset LLM Responses ──────────────────────────────

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

export const MOCK_REVIEW_RESPONSE = JSON.stringify({
  decision: "continue",
  nextPhase: "discovery",
  reasoning: "第一轮已完成信息收集，继续进入发现阶段",
})

export const MOCK_REACT_FUNCTION_CALL = {
  content: null,
  functionCall: {
    name: "fscan_port_scan",
    arguments: JSON.stringify({ target: "127.0.0.1", ports: "1-1000" }),
  },
  provider: "test-provider",
  model: "test-model",
  durationMs: 500,
}

export const MOCK_REACT_FINAL_ANSWER = {
  content: "扫描完成。发现 127.0.0.1 开放了 80 (HTTP) 和 22 (SSH) 端口。",
  functionCall: undefined,
  provider: "test-provider",
  model: "test-model",
  durationMs: 800,
}

export const MOCK_VERIFIER_POC = JSON.stringify({
  code: "import requests\nr = requests.get('http://target/vuln?id=1 OR 1=1')\nprint(r.status_code)",
  language: "python",
})

export const MOCK_INVALID_JSON = "这不是有效的 JSON {{{"
