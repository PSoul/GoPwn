/**
 * 轮询 GoPwn 项目状态直到完成，自动审批，事后检查 flag。
 * 用法: npx tsx scripts/xbow-eval/poll-project.ts <projectId> [expectedFlag]
 */

const PROJECT_ID = process.argv[2]
const EXPECTED_FLAG = process.argv[3] ?? ""
const BASE = process.env.GOPWN_URL ?? "http://localhost:3001"
const ACCOUNT = "admin@company.local"
const PASSWORD = "Prototype@2026"

if (!PROJECT_ID) {
  console.error("Usage: npx tsx scripts/xbow-eval/poll-project.ts <projectId> [expectedFlag]")
  process.exit(1)
}

let cookie = ""

async function login() {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: ACCOUNT, password: PASSWORD }),
    redirect: "manual",
  })
  const setCookie = resp.headers.getSetCookie?.() ?? []
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
  console.log("[auth] 已登录")
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const resp = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
      cookie,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  })
  const text = await resp.text()
  try {
    return JSON.parse(text)
  } catch {
    console.error(`[api] 非 JSON 响应 ${path}: ${text.slice(0, 200)}`)
    return null
  }
}

async function approveAll(): Promise<number> {
  const data = await api(`/api/projects/${PROJECT_ID}/approvals`)
  if (!data) return 0
  const approvals = data.approvals ?? data ?? []
  let n = 0
  for (const a of approvals) {
    if (a.status === "pending") {
      await api(`/api/approvals/${a.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      })
      console.log(`  [approve] ${a.id}`)
      n++
    }
  }
  return n
}

function searchFlag(obj: any, flag: string): boolean {
  if (!flag) return false
  if (typeof obj === "string") return obj.includes(flag)
  if (Array.isArray(obj)) return obj.some((item) => searchFlag(item, flag))
  if (obj && typeof obj === "object") return Object.values(obj).some((v) => searchFlag(v, flag))
  return false
}

async function main() {
  await login()

  const terminal = new Set(["completed", "stopped", "failed"])
  const startTime = Date.now()
  const timeout = 600_000 // 10 min

  while (Date.now() - startTime < timeout) {
    const proj = await api(`/api/projects/${PROJECT_ID}`)
    if (!proj) {
      console.log("[poll] API 无响应，等待...")
      await new Promise((r) => setTimeout(r, 10000))
      continue
    }

    const lc = proj.lifecycle ?? "?"
    const phase = proj.currentPhase ?? "?"
    const round = proj.currentRound ?? 0
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)

    console.log(`[${elapsed}s] lifecycle=${lc} phase=${phase} round=${round}`)

    if (lc === "waiting_approval") {
      const n = await approveAll()
      if (n > 0) console.log(`  自动审批 ${n} 项`)
    }

    if (terminal.has(lc)) {
      console.log(`\n=== 终态: ${lc} ===`)

      // 收集结果
      const [findings, evidence, mcpRuns] = await Promise.all([
        api(`/api/projects/${PROJECT_ID}/findings`),
        api(`/api/projects/${PROJECT_ID}/evidence`),
        api(`/api/projects/${PROJECT_ID}/mcp-runs`),
      ])

      const findingsList = findings?.findings ?? findings ?? []
      const evidenceList = evidence?.evidence ?? evidence ?? []
      const mcpRunsList = mcpRuns?.mcpRuns ?? mcpRuns ?? []

      console.log(`Findings: ${findingsList.length}`)
      console.log(`Evidence: ${evidenceList.length}`)
      console.log(`MCP Runs: ${mcpRunsList.length}`)

      // 列出 findings
      for (const f of findingsList) {
        console.log(`  [${f.severity}] ${f.title} → ${f.affectedTarget ?? f.target}`)
      }

      // 事后检查 flag
      if (EXPECTED_FLAG) {
        const found =
          searchFlag(findingsList, EXPECTED_FLAG) ||
          searchFlag(evidenceList, EXPECTED_FLAG) ||
          searchFlag(mcpRunsList, EXPECTED_FLAG)

        console.log(`\nFlag 验证: ${found ? "FOUND" : "NOT FOUND"}`)
        if (!found) {
          // 在原始输出中搜索
          console.log("  在 MCP 运行输出中搜索...")
          for (const run of mcpRunsList) {
            if (run.rawOutput && run.rawOutput.includes(EXPECTED_FLAG)) {
              console.log(`  -> 在 ${run.toolName} 输出中找到 flag!`)
            }
          }
        }
      }

      console.log(`\n耗时: ${elapsed}s`)
      process.exit(0)
    }

    await new Promise((r) => setTimeout(r, 10000))
  }

  console.log("超时")
  process.exit(1)
}

main().catch(console.error)
