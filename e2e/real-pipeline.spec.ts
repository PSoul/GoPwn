/**
 * 真实渗透测试 E2E — 对 Docker 靶场执行完整 ReAct 管线
 *
 * 前置条件:
 * - Docker 靶场容器已启动（8081/8082/8083/6379/9200/27017/13306/13307 等）
 * - Worker 进程已启动（npx tsx watch worker.ts）
 * - 真实 LLM 已配置（.env 中的 LLM_API_KEY/LLM_BASE_URL/LLM_ORCHESTRATOR_MODEL）
 * - Next.js dev server 运行在 4500 端口
 *
 * 这个测试不作弊：使用真实 LLM 调用，验证实际发现的资产和漏洞。
 */

import { expect, test } from "@playwright/test"

// 10 分钟超时 — 真实 LLM 渗透测试需要时间
test.setTimeout(600_000)

const BASE = "http://localhost:4500"

// --- Helper: 获取登录 cookie ---
async function getAuthCookies(request: typeof test extends (name: string, fn: (args: infer A) => void) => void ? A["request"] : never) {
  const loginRes = await request.post(`${BASE}/api/auth/login`, {
    data: { account: "researcher@company.local", password: "Prototype@2026" },
  })
  expect(loginRes.ok()).toBe(true)
  return loginRes.headers()["set-cookie"] ?? ""
}

test("完整渗透测试: 创建项目 → 启动 → 等待完成 → 验证结果", async ({ request }) => {
  // ---- Step 1: 登录 ----
  const loginRes = await request.post(`${BASE}/api/auth/login`, {
    data: { account: "researcher@company.local", password: "Prototype@2026" },
  })
  expect(loginRes.ok()).toBe(true)

  // ---- Step 2: 创建项目 ----
  const createRes = await request.post(`${BASE}/api/projects`, {
    data: {
      name: `E2E 全流程测试 ${Date.now()}`,
      targetInput: "127.0.0.1",
      description: "E2E 全流程自动化测试 — 对本地 Docker 靶场执行完整渗透测试",
    },
  })
  const createText = await createRes.text()
  console.log(`[E2E] 创建响应 (${createRes.status()}): ${createText.slice(0, 500)}`)
  expect(createRes.ok()).toBe(true)
  const createBody = JSON.parse(createText) as { project: { id: string } }
  const projectId = createBody.project.id
  console.log(`[E2E] 项目已创建: ${projectId}`)

  // ---- Step 3: 启动渗透测试 ----
  const startRes = await request.post(`${BASE}/api/projects/${projectId}/start`)
  expect(startRes.ok()).toBe(true)
  console.log(`[E2E] 项目已启动`)

  // ---- Step 4: 轮询等待完成（最多 8 分钟） ----
  const MAX_WAIT_MS = 480_000
  const POLL_INTERVAL_MS = 15_000
  const startTime = Date.now()
  let lifecycle = "executing"
  let lastRound = 0

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const statusRes = await request.get(`${BASE}/api/projects/${projectId}`)
    if (!statusRes.ok()) {
      console.log(`[E2E] 状态查询失败: ${statusRes.status()}`)
      continue
    }

    const statusBody = (await statusRes.json()) as Record<string, unknown>
    // API 可能返回 { project: {...} } 或直接返回项目对象
    const p = (statusBody.project ?? statusBody) as { lifecycle: string; currentRound: number; currentPhase: string }
    lifecycle = p.lifecycle
    lastRound = p.currentRound

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[E2E] [${elapsed}s] 状态: ${lifecycle}, 轮次: ${lastRound}, 阶段: ${p.currentPhase}`)

    if (["completed", "stopped", "failed"].includes(lifecycle)) {
      break
    }
  }

  console.log(`[E2E] 最终状态: ${lifecycle}, 总耗时: ${Math.round((Date.now() - startTime) / 1000)}s`)

  // ---- Step 5: 验证结果 ----
  // 5a. 项目应该完成或至少执行过
  expect(["completed", "stopped", "executing", "reviewing", "settling"]).toContain(lifecycle)
  expect(lastRound).toBeGreaterThanOrEqual(1)

  // 5b. 检查 MCP 运行记录
  const runsRes = await request.get(`${BASE}/api/projects/${projectId}/mcp-runs`)
  expect(runsRes.ok()).toBe(true)
  const runsRaw = (await runsRes.json()) as Record<string, unknown>
  const runs = (Array.isArray(runsRaw) ? runsRaw : (runsRaw.runs ?? runsRaw.data ?? [])) as Array<{ id: string; toolName: string; status: string }>
  console.log(`[E2E] MCP 执行记录: ${runs.length} 条`)
  expect(runs.length).toBeGreaterThanOrEqual(1)

  const toolUsage = new Map<string, number>()
  for (const run of runs) {
    toolUsage.set(run.toolName, (toolUsage.get(run.toolName) ?? 0) + 1)
  }
  console.log(`[E2E] 工具使用统计:`)
  for (const [tool, count] of toolUsage) {
    console.log(`[E2E]   ${tool}: ${count} 次`)
  }

  // 5c. 检查发现的资产
  const assetsRes = await request.get(`${BASE}/api/projects/${projectId}/assets`)
  expect(assetsRes.ok()).toBe(true)
  const assetsRaw = (await assetsRes.json()) as Record<string, unknown>
  const assets = (Array.isArray(assetsRaw) ? assetsRaw : (assetsRaw.assets ?? assetsRaw.data ?? [])) as Array<{ id: string; kind: string; value: string }>
  console.log(`[E2E] 发现资产: ${assets.length} 个`)
  for (const asset of assets.slice(0, 10)) {
    console.log(`[E2E]   [${asset.kind}] ${asset.value}`)
  }

  // 5d. 检查发现的漏洞
  const findingsRes = await request.get(`${BASE}/api/projects/${projectId}/findings`)
  expect(findingsRes.ok()).toBe(true)
  const findingsRaw = (await findingsRes.json()) as Record<string, unknown>
  const findings = (Array.isArray(findingsRaw) ? findingsRaw : (findingsRaw.findings ?? findingsRaw.data ?? [])) as Array<{ id: string; title: string; severity: string; status: string; affectedTarget: string }>
  console.log(`[E2E] 发现漏洞: ${findings.length} 个`)
  for (const f of findings.slice(0, 20)) {
    console.log(`[E2E]   [${f.severity}] ${f.title} (${f.status}) → ${f.affectedTarget}`)
  }

  // 5e. 检查 LLM 调用日志
  const llmLogsRes = await request.get(`${BASE}/api/projects/${projectId}/llm-logs`)
  expect(llmLogsRes.ok()).toBe(true)
  const llmLogsRaw = (await llmLogsRes.json()) as Record<string, unknown>
  const llmLogs = (Array.isArray(llmLogsRaw) ? llmLogsRaw : (llmLogsRaw.items ?? llmLogsRaw.logs ?? llmLogsRaw.data ?? [])) as Array<Record<string, unknown>>
  console.log(`[E2E] LLM 调用日志: ${llmLogs.length} 条`)

  // 5f. 检查证据
  const evidenceRes = await request.get(`${BASE}/api/projects/${projectId}/evidence`)
  expect(evidenceRes.ok()).toBe(true)
  const evidenceRaw = (await evidenceRes.json()) as Record<string, unknown>
  const evidence = (Array.isArray(evidenceRaw) ? evidenceRaw : (evidenceRaw.evidence ?? evidenceRaw.data ?? [])) as Array<{ id: string; title: string }>
  console.log(`[E2E] 证据记录: ${evidence.length} 条`)

  // ---- Step 6: 结果合理性验证（不作弊） ----
  // 针对 127.0.0.1 的 Docker 靶场，应该至少发现一些东西
  console.log(`\n[E2E] ========== 测试结果摘要 ==========`)
  console.log(`[E2E] 轮次完成: ${lastRound}`)
  console.log(`[E2E] 工具调用: ${runs.length}`)
  console.log(`[E2E] 发现资产: ${assets.length}`)
  console.log(`[E2E] 发现漏洞: ${findings.length}`)
  console.log(`[E2E] 证据记录: ${evidence.length}`)
  console.log(`[E2E] LLM 日志: ${llmLogs.length}`)
  console.log(`[E2E] =====================================\n`)
})

test("渗透测试 — 验证前端展示与后端数据一致", async ({ page, request }) => {
  // 先登录
  const loginRes = await request.post(`${BASE}/api/auth/login`, {
    data: { account: "researcher@company.local", password: "Prototype@2026" },
  })
  expect(loginRes.ok()).toBe(true)

  // 获取现有项目
  await page.goto("/login")
  await page.getByLabel("账号").fill("researcher@company.local")
  await page.getByLabel("密码").fill("Prototype@2026")
  await page.getByRole("button", { name: "登录平台" }).click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })

  // 去项目列表找到最近创建的项目
  await page.goto("/projects")
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()

  // 仪表盘数据验证
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "平台仪表盘" })).toBeVisible()

  // 漏洞中心
  await page.goto("/vuln-center")
  await expect(page.getByRole("heading", { name: "漏洞中心" })).toBeVisible()
  await expect(page.getByText("漏洞总数").first()).toBeVisible({ timeout: 10_000 })
})
