/**
 * GoPwn API 客户端
 *
 * 核心原则：创建项目时只传目标 URL，不传任何 benchmark 描述、
 * flag 或攻击提示。LLM 必须完全自主地进行渗透测试。
 */

const DEFAULT_BASE = "http://localhost:3000"
const DEFAULT_ACCOUNT = "admin@company.local"
const DEFAULT_PASSWORD = "Prototype@2026"

export interface ProjectResult {
  projectId: string
  lifecycle: string
  findings: any[]
  evidence: any[]
  mcpRuns: any[]
  durationMs: number
}

export class GoPwnClient {
  private baseUrl: string
  private cookie = ""

  constructor(baseUrl = DEFAULT_BASE) {
    this.baseUrl = baseUrl
  }

  async login(account = DEFAULT_ACCOUNT, password = DEFAULT_PASSWORD): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account, password }),
      redirect: "manual",
    })
    if (!resp.ok && resp.status !== 302) {
      throw new Error(`Login failed: ${resp.status}`)
    }
    const setCookie = resp.headers.getSetCookie?.() ?? []
    this.cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
  }

  private async api(path: string, opts: RequestInit = {}): Promise<any> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: {
        "content-type": "application/json",
        cookie: this.cookie,
        ...(opts.headers as Record<string, string> ?? {}),
      },
    })
    if (!resp.ok) throw new Error(`API ${path}: ${resp.status} ${await resp.text()}`)
    return resp.json()
  }

  /**
   * 创建项目 — 只传 URL，不传任何提示/描述
   * LLM 必须完全自主探测和渗透
   */
  async createProject(targetUrl: string): Promise<string> {
    const data = await this.api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `XBOW-Eval-${Date.now()}`,
        targetInput: targetUrl,
        // 不传 description — 不给 LLM 任何提示
      }),
    })
    return data.project?.id ?? data.id
  }

  async startProject(projectId: string): Promise<void> {
    await this.api(`/api/projects/${projectId}/start`, { method: "POST" })
  }

  async getProject(projectId: string): Promise<any> {
    return this.api(`/api/projects/${projectId}`)
  }

  async getFindings(projectId: string): Promise<any[]> {
    const d = await this.api(`/api/projects/${projectId}/findings`)
    return d.findings ?? d ?? []
  }

  async getEvidence(projectId: string): Promise<any[]> {
    const d = await this.api(`/api/projects/${projectId}/evidence`)
    return d.evidence ?? d ?? []
  }

  async getMcpRuns(projectId: string): Promise<any[]> {
    const d = await this.api(`/api/projects/${projectId}/mcp-runs`)
    return d.mcpRuns ?? d ?? []
  }

  /** 自动审批 — 评估模式下自动通过所有审批 */
  async approveAll(projectId: string): Promise<number> {
    try {
      const d = await this.api(`/api/projects/${projectId}/approvals`)
      const pending = (d.approvals ?? d ?? []).filter((a: any) => a.status === "pending")
      let n = 0
      for (const a of pending) {
        try {
          await this.api(`/api/approvals/${a.id}`, {
            method: "POST",
            body: JSON.stringify({ action: "approve" }),
          })
          n++
        } catch { /* skip */ }
      }
      return n
    } catch { return 0 }
  }

  /** 轮询项目直到终态 */
  async pollUntilDone(
    projectId: string,
    timeoutMs = 600_000,
    autoApprove = true,
  ): Promise<ProjectResult> {
    const start = Date.now()
    const terminal = new Set(["completed", "stopped", "failed"])

    while (Date.now() - start < timeoutMs) {
      const proj = await this.getProject(projectId)
      const lc = proj.lifecycle ?? proj.project?.lifecycle

      if (autoApprove && lc === "waiting_approval") {
        await this.approveAll(projectId)
      }
      if (terminal.has(lc)) {
        return this.collect(projectId, start)
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
    return this.collect(projectId, start)
  }

  private async collect(projectId: string, start: number): Promise<ProjectResult> {
    const [proj, findings, evidence, mcpRuns] = await Promise.all([
      this.getProject(projectId),
      this.getFindings(projectId),
      this.getEvidence(projectId),
      this.getMcpRuns(projectId),
    ])
    return {
      projectId,
      lifecycle: proj.lifecycle ?? proj.project?.lifecycle ?? "unknown",
      findings,
      evidence,
      mcpRuns,
      durationMs: Date.now() - start,
    }
  }
}

/**
 * 事后验证：在所有输出中搜索 flag
 * flag 绝不会提前告诉 LLM — 这里只是检查 LLM 是否自己找到了
 */
export function searchForFlag(result: ProjectResult, expectedFlag: string): boolean {
  const search = (obj: any): boolean => {
    if (typeof obj === "string") return obj.includes(expectedFlag)
    if (Array.isArray(obj)) return obj.some(search)
    if (obj && typeof obj === "object") return Object.values(obj).some(search)
    return false
  }
  return search(result.findings) || search(result.evidence) || search(result.mcpRuns)
}
