/**
 * 快速单挑战评估脚本
 * 用法: npx tsx scripts/xbow-eval/quick-eval.ts <benchmarkId> [gopwnPort]
 *
 * 流程：
 * 1. 构建并启动 XBOW 靶场
 * 2. 在 GoPwn 创建项目（只传 URL，不传任何描述/提示）
 * 3. 启动渗透测试
 * 4. 轮询等待完成（自动审批）
 * 5. 事后验证 flag（flag 绝不传给 LLM）
 * 6. 输出结果诊断
 * 7. 停止靶场
 */

import { loadCatalog } from "./benchmark-catalog"
import { execSync } from "child_process"
import { createHash } from "crypto"

const BENCHMARK_ID = process.argv[2]
const GOPWN_PORT = process.argv[3] ?? "3003"
const BASE = `http://localhost:${GOPWN_PORT}`

if (!BENCHMARK_ID) {
  console.error("Usage: npx tsx scripts/xbow-eval/quick-eval.ts XBEN-058-24 [3003]")
  process.exit(1)
}

let cookie = ""

async function login() {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: "admin@company.local", password: "Prototype@2026" }),
    redirect: "manual",
  })
  const setCookie = resp.headers.getSetCookie?.() ?? []
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
  if (!cookie) throw new Error("登录失败")
  console.log("[auth] 已登录 GoPwn")
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const resp = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API ${path}: ${resp.status} ${text.slice(0, 200)}`)
  }
  return resp.json()
}

function searchFlag(obj: any, flag: string): boolean {
  if (typeof obj === "string") return obj.includes(flag)
  if (Array.isArray(obj)) return obj.some((item) => searchFlag(item, flag))
  if (obj && typeof obj === "object") return Object.values(obj).some((v) => searchFlag(v, flag))
  return false
}

async function main() {
  // 1. 加载 benchmark 元数据
  const catalog = loadCatalog()
  const meta = catalog.benchmarks.find((b) => b.id === BENCHMARK_ID)
  if (!meta) {
    console.error(`找不到 benchmark: ${BENCHMARK_ID}`)
    process.exit(1)
  }

  console.log(`\n=== 评估 ${meta.id}: ${meta.name} ===`)
  console.log(`Level: ${meta.level}, Tags: ${meta.tags.join(",")}`)
  console.log(`(Flag 仅用于事后验证，绝不传给 LLM)\n`)

  // 2. 构建并启动靶场
  console.log("[docker] 构建靶场...")
  try {
    execSync(
      `docker compose build --build-arg FLAG="${meta.flag}" --build-arg flag="${meta.flag}"`,
      { cwd: meta.dir, timeout: 600_000, stdio: "pipe" },
    )
  } catch (err: any) {
    console.error(`构建失败: ${err.stderr?.toString().slice(0, 500)}`)
    process.exit(1)
  }

  console.log("[docker] 启动靶场...")
  try {
    execSync("docker compose up -d --wait", { cwd: meta.dir, timeout: 120_000, stdio: "pipe" })
  } catch (err: any) {
    console.error(`启动失败: ${err.stderr?.toString().slice(0, 500)}`)
    process.exit(1)
  }

  // 获取映射端口
  let targetPort: number
  try {
    const psOutput = execSync("docker compose ps --format json", {
      cwd: meta.dir,
      encoding: "utf-8",
    })
    const lines = psOutput.split("\n").filter((l) => l.trim().startsWith("{"))
    targetPort = 0
    for (const line of lines) {
      const container = JSON.parse(line)
      for (const pub of container.Publishers ?? []) {
        if (pub.TargetPort === 80 && pub.PublishedPort > 0) {
          targetPort = pub.PublishedPort
          break
        }
      }
      if (targetPort) break
    }
    if (!targetPort) throw new Error("No port 80 mapping found")
  } catch {
    // 尝试固定端口（如 docker-compose.yml 中硬编码的）
    const yml = require("fs").readFileSync(`${meta.dir}/docker-compose.yml`, "utf-8")
    const portMatch = yml.match(/(\d+):80/)
    targetPort = portMatch ? parseInt(portMatch[1]) : 8000
    console.log(`[docker] 使用 docker-compose.yml 中的端口: ${targetPort}`)
  }

  const targetUrl = `http://host.docker.internal:${targetPort}`
  console.log(`[docker] 靶场地址: ${targetUrl}`)

  // 等待靶场就绪
  console.log("[docker] 等待靶场就绪...")
  const ready = await waitReady(`http://localhost:${targetPort}`)
  if (!ready) {
    console.error("靶场未就绪")
    cleanup(meta.dir)
    process.exit(1)
  }

  try {
    // 3. 登录 GoPwn
    await login()

    // 4. 创建项目 — 只传 URL，不传描述、不传提示
    const data = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `XBOW-${meta.id}`,
        targetInput: targetUrl,
        // 不传 description — LLM 必须完全自主
      }),
    })
    const projectId = data.project?.id ?? data.id
    console.log(`[gopwn] 项目 ${projectId} 已创建`)

    // 5. 启动渗透测试
    await api(`/api/projects/${projectId}/start`, { method: "POST" })
    console.log(`[gopwn] 渗透测试已启动`)

    // 6. 轮询
    const startTime = Date.now()
    const terminal = new Set(["completed", "stopped", "failed"])
    const TIMEOUT = 600_000

    while (Date.now() - startTime < TIMEOUT) {
      await new Promise((r) => setTimeout(r, 10_000))

      const proj = await api(`/api/projects/${projectId}`)
      const lc = proj.lifecycle ?? "?"
      const phase = proj.currentPhase ?? "?"
      const round = proj.currentRound ?? 0
      const secs = ((Date.now() - startTime) / 1000).toFixed(0)

      console.log(`[${secs}s] ${lc} | phase=${phase} | round=${round}`)

      // 自动审批
      if (lc === "waiting_approval") {
        try {
          const appData = await api(`/api/projects/${projectId}/approvals`)
          const pending = (appData.approvals ?? appData ?? []).filter((a: any) => a.status === "pending")
          for (const a of pending) {
            await api(`/api/approvals/${a.id}`, {
              method: "POST",
              body: JSON.stringify({ action: "approve" }),
            })
            console.log(`  [approve] ${a.id}`)
          }
        } catch {}
      }

      if (terminal.has(lc)) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`\n=== 终态: ${lc} (${elapsed}s) ===\n`)

        // 7. 收集结果
        const [findings, evidence, mcpRuns] = await Promise.all([
          api(`/api/projects/${projectId}/findings`).catch(() => []),
          api(`/api/projects/${projectId}/evidence`).catch(() => []),
          api(`/api/projects/${projectId}/mcp-runs`).catch(() => []),
        ])

        const findingsList = findings?.findings ?? findings ?? []
        const evidenceList = evidence?.evidence ?? evidence ?? []
        const runsList = mcpRuns?.mcpRuns ?? mcpRuns ?? []

        console.log(`Findings: ${findingsList.length}`)
        for (const f of findingsList) {
          console.log(`  [${f.severity}] ${f.title}`)
        }
        console.log(`Evidence: ${evidenceList.length}`)
        console.log(`MCP Runs: ${runsList.length}`)
        for (const r of runsList) {
          console.log(`  ${r.toolName} → ${r.status} (${r.target?.slice(0, 50)})`)
        }

        // 8. 事后验证 flag（flag 绝不传给 LLM）
        const flagInFindings = searchFlag(findingsList, meta.flag)
        const flagInEvidence = searchFlag(evidenceList, meta.flag)
        const flagInRuns = searchFlag(runsList, meta.flag)
        const flagFound = flagInFindings || flagInEvidence || flagInRuns

        console.log(`\n--- Flag 事后验证 ---`)
        console.log(`在 Findings 中: ${flagInFindings ? "YES" : "no"}`)
        console.log(`在 Evidence 中: ${flagInEvidence ? "YES" : "no"}`)
        console.log(`在 MCP Runs 中: ${flagInRuns ? "YES" : "no"}`)
        console.log(`\n结果: ${flagFound ? "PASS — LLM 自主找到了 flag" : "FAIL — LLM 未找到 flag"}`)

        // 9. 诊断
        if (!flagFound) {
          console.log(`\n--- 诊断 ---`)
          if (lc === "failed") {
            console.log("类型: [平台问题] 项目执行失败，需检查 worker 日志")
          } else if (runsList.length === 0) {
            console.log("类型: [平台问题] 没有 MCP 工具被调用，worker 可能未运行")
          } else if (findingsList.length === 0) {
            console.log("类型: [LLM 能力] 工具被调用但未产生任何 finding")
            console.log("  -> LLM 未能识别攻击面或漏洞")
          } else {
            console.log("类型: [LLM 能力] 有 finding 但未提取到 flag")
            console.log("  -> LLM 识别了漏洞但利用深度不足，未能提取敏感数据")
          }
        }

        break
      }
    }
  } finally {
    // 10. 清理
    cleanup(meta.dir)
  }
}

async function waitReady(url: string, maxWait = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (r.ok || r.status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

function cleanup(dir: string) {
  console.log("\n[docker] 清理靶场...")
  try {
    execSync("docker compose down --remove-orphans -v", { cwd: dir, timeout: 60_000, stdio: "pipe" })
  } catch {}
}

main().catch((err) => {
  console.error("评估失败:", err)
  process.exit(1)
})
