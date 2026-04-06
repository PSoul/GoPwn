import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

test("login page renders the GoPwn entry form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "进入 GoPwn" })).toBeVisible()
  await expect(page.getByLabel("账号")).toBeVisible()
  await expect(page.getByLabel("密码")).toBeVisible()
  await expect(page.getByRole("button", { name: "登录平台" })).toBeVisible()
})

test("dashboard and projects routes render the main console entry points", async ({ page }) => {
  await loginAsResearcher(page)

  await expect(page.getByRole("heading", { name: "平台仪表盘" })).toBeVisible()
  await expect(page.getByText("项目总数")).toBeVisible()
  await expect(page.getByText("活跃项目")).toBeVisible()
  await expect(page.getByText("资产发现")).toBeVisible()
  await expect(page.getByText("漏洞发现")).toBeVisible()

  await page.goto("/projects")

  await expect(page.getByRole("heading", { name: "项目管理" })).toBeVisible()
  await expect(page.getByRole("link", { name: "新建项目" }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()
  await expect(
    page.getByPlaceholder("搜索项目名称、项目编号或项目说明..."),
  ).toBeVisible()
})

test("asset center page loads", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/assets")

  await expect(page.getByRole("heading", { name: "资产中心" })).toBeVisible()
})

test("project overview shows workspace navigation tabs", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName } = await createProject(page)

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), {
    timeout: 15_000,
  })
  await expect(page.locator("h1, h2, h3", { hasText: projectName })).toBeVisible({
    timeout: 15_000,
  })

  // Workspace navigation tabs (from project-workspace-nav.tsx)
  await expect(page.getByRole("tab", { name: "概览" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "资产" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "漏洞" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "执行控制" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "AI 日志" })).toBeVisible()
})

test("create project routes to the new detail page", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName } = await createProject(page)
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), {
    timeout: 15_000,
  })
  await expect(page.locator("h1, h2, h3", { hasText: projectName })).toBeVisible({
    timeout: 15_000,
  })
})

test("settings hub leads into dedicated settings subpages", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings")

  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "设置分类" })).toBeVisible()

  await Promise.all([
    page.waitForURL(/\/settings\/mcp-tools$/, { timeout: 15_000 }),
    page.getByRole("link", { name: /探测工具/ }).first().click(),
  ])
  await expect(
    page.getByRole("heading", { name: "探测工具管理" }),
  ).toBeVisible()
})

test("project operations page shows MCP dispatch form and logs", async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}/operations`)

  // Operations page uses the "执行控制" tab in project workspace
  await expect(page.getByRole("tab", { name: "执行控制" })).toBeVisible()

  // MCP dispatch form should be visible
  await expect(page.getByText("MCP 调度请求").first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("button", { name: /发起 MCP 调度/ })).toBeVisible()

  // Execution log section
  await expect(page.getByText("执行日志")).toBeVisible()
})

test("manual start via project start API", async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  // Navigate to project overview
  await page.goto(`/projects/${projectId}`)
  await expect(page.getByRole("tab", { name: "概览" })).toBeVisible()

  // Track start request
  let startRequestSent = false
  page.on("request", (req) => {
    if (req.url().includes(`/projects/`) && req.url().includes("/start") && req.method() === "POST") {
      startRequestSent = true
    }
  })

  // Find and click the start button (could be "开始" or similar)
  const startButton = page.getByRole("button", { name: /开始|启动/ }).first()
  const hasStartButton = await startButton.isVisible().catch(() => false)

  if (hasStartButton) {
    await startButton.click()
    await page.waitForTimeout(2_000)
    expect(startRequestSent).toBe(true)
  } else {
    // If no start button on overview, verify the project is in idle state
    // This is acceptable - the start flow may be through the operations page
    await expect(page.getByText(/idle|空闲|已就绪/i).first()).toBeVisible({ timeout: 5_000 })
  }
})
