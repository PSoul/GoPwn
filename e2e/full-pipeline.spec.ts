/**
 * Full Pipeline E2E Tests
 *
 * This file tests the complete penetration testing pipeline:
 * - API-level tests that don't need the worker
 * - Browser-level project creation and verification
 * - (Skipped) Full pipeline test that requires Worker + LLM
 *
 * IMPORTANT: The full pipeline test requires:
 * - Docker lab containers running (ports 8081, 8082, 8083, 6379, 9200, etc.)
 * - Worker process running
 * - Real LLM configured in .env
 */
import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

// ---------------------------------------------------------------------------
// API-level tests (no browser needed, use request context)
// ---------------------------------------------------------------------------

test("API: 健康检查", async ({ request }) => {
  const res = await request.get("/api/health")
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { status: string; database: string }
  expect(body.status).toBe("ok")
  expect(body.database).toBe("connected")
})

test("API: 未认证请求被拒绝", async ({ request }) => {
  const res = await request.get("/api/projects")
  // The middleware redirects unauthenticated API requests or returns 401/3xx
  expect([401, 302, 307].includes(res.status()) || !res.ok()).toBe(true)
})

test("API: 登录接口返回正确格式", async ({ request }) => {
  const res = await request.post("/api/auth/login", {
    data: {
      account: "researcher@company.local",
      password: "Prototype@2026",
    },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { redirectTo?: string; error?: string }
  expect(body.error).toBeUndefined()
})

test("API: 错误凭据被拒绝", async ({ request }) => {
  const res = await request.post("/api/auth/login", {
    data: {
      account: "nobody@company.local",
      password: "wrongpassword",
    },
  })
  expect(res.ok()).toBe(false)
})

// ---------------------------------------------------------------------------
// Browser-level tests (project creation and API format verification)
// ---------------------------------------------------------------------------

test("创建项目并验证响应格式", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName } = await createProject(page)

  // Project ID should follow the expected format
  expect(projectId).toBeTruthy()
  expect(projectName).toContain("E2E 本地项目")

  // Navigate to the new project page (createProject may not auto-redirect)
  await page.goto(`/projects/${projectId}`)
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), {
    timeout: 15_000,
  })

  // Project overview should show security and asset sections
  await expect(page.getByRole("heading", { name: "安全发现" })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("heading", { name: "资产发现" })).toBeVisible({ timeout: 10_000 })
})

test("项目列表显示已创建项目", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectName } = await createProject(page)

  // Navigate to project list
  await page.goto("/projects")
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()

  // The newly created project should appear
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 })
})

test("项目操作页面加载", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  await page.goto(`/projects/${projectId}/operations`)

  // Operations page should show workspace tabs
  await expect(page.getByRole("tab", { name: "执行控制" })).toBeVisible()

  // Should display execution log section
  await expect(page.getByText("执行日志")).toBeVisible({ timeout: 10_000 })
})

test("项目 AI 日志页面加载", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  await page.goto(`/projects/${projectId}/ai-logs`)

  // AI logs tab should be active
  await expect(page.getByRole("tab", { name: "AI 日志" })).toBeVisible()
})

test("项目资产页面加载", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  await page.goto(`/projects/${projectId}/assets`)

  // Assets tab should be active
  await expect(page.getByRole("tab", { name: "资产" })).toBeVisible()
})

test("项目漏洞页面加载", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  await page.goto(`/projects/${projectId}/findings`)

  // Findings tab should be active
  await expect(page.getByRole("tab", { name: "漏洞" })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Full pipeline test (requires Worker + LLM + Docker targets)
// ---------------------------------------------------------------------------

test.skip("完整渗透测试流程（需要 Worker + LLM）", async ({ page }) => {
  // This test creates a real project targeting Docker vulnerable containers,
  // starts the penetration test, waits for it to complete (or timeout),
  // and verifies that assets and findings were discovered.
  //
  // Steps:
  // 1. Login and create project targeting Docker labs
  // 2. Click "开始自动化测试" to start the pipeline
  // 3. Monitor via SSE events / polling for round progress
  // 4. Verify assets were discovered
  // 5. Verify findings were created
  // 6. Check MCP runs were recorded
  // 7. Export report
  //
  // Implementation deferred until full infrastructure is running.
  test.setTimeout(600_000) // 10 minutes for full pipeline

  await loginAsResearcher(page)
  const { projectId } = await createProject(
    page,
    "http://127.0.0.1:8081\nhttp://127.0.0.1:8082\nhttp://127.0.0.1:8083",
  )

  // Navigate to project and start
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: /开始自动化测试/ }).click()

  // Wait for at least one round to complete (poll operations page)
  await page.goto(`/projects/${projectId}/operations`)

  // TODO: implement SSE monitoring / polling logic
  // TODO: verify assets created
  // TODO: verify findings created
  // TODO: verify MCP runs recorded
  // TODO: export report and verify download
})
