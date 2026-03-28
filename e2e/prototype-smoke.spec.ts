import { expect, test } from "@playwright/test"

async function loginAsResearcher(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.getByLabel("账号").fill("researcher@company.local")
  await page.getByLabel("密码").fill("Prototype@2026")
  await page.getByLabel("验证码").fill("7K2Q")
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  )

  await page.getByRole("button", { name: "登录平台" }).click()

  const loginResponse = await loginResponsePromise
  expect(loginResponse.ok()).toBe(true)
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })
}

async function createProject(page: import("@playwright/test").Page) {
  await page.goto("/projects/new")
  const suffix = Date.now().toString()
  const projectName = `E2E 本地项目 ${suffix}`
  const description = `E2E 验证项目 ${suffix}，用于检查新项目表单、项目工作台与结果页路由。`

  await page.getByLabel("项目名称").fill(projectName)
  await page.getByLabel("目标").fill("http://127.0.0.1:18080/WebGoat\n127.0.0.1")
  await page.getByLabel("项目说明").fill(description)

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/projects") &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  )

  await page.getByRole("button", { name: "创建项目" }).click()

  const createResponse = await createResponsePromise
  expect(createResponse.ok()).toBe(true)

  const payload = (await createResponse.json()) as { project?: { id?: string } }
  const projectId = payload.project?.id ?? ""

  expect(projectId).toMatch(/^proj-\d{8}-[a-f0-9]{8}$/)
  return { projectId, projectName, description }
}

test("login page exposes standard platform account entry", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "进入授权外网安全评估平台" })).toBeVisible()
  await expect(page.getByLabel("账号")).toBeVisible()
  await expect(page.getByLabel("密码")).toBeVisible()
  await expect(page.getByLabel("验证码")).toBeVisible()
  await expect(page.getByRole("button", { name: "登录平台" })).toBeVisible()
})

test("dashboard and projects routes render the main console entry points", async ({ page }) => {
  await loginAsResearcher(page)

  await expect(page.getByRole("heading", { name: "平台仪表盘" })).toBeVisible()
  await expect(page.getByText("项目总数")).toBeVisible()
  await expect(page.getByText("已发现资产")).toBeVisible()
  await expect(page.getByText("已发现漏洞")).toBeVisible()
  await expect(page.getByText("待审批动作").first()).toBeVisible()
  await expect(page.getByText("最近结果更新")).toBeVisible()
  await expect(page.getByText("全局资产预览")).toBeVisible()

  await page.goto("/projects")

  await expect(page.getByRole("heading", { name: "项目管理" })).toBeVisible()
  await expect(page.getByRole("link", { name: "新建项目" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()
  await expect(page.getByPlaceholder("搜索项目名称、目标、项目编号或项目说明...")).toBeVisible()
})

test("asset center exposes typed result views", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/assets?view=domains-web")

  await expect(page.getByRole("heading", { name: "资产中心" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "域名 / Web" })).toBeVisible()
  await expect(page.getByRole("tab", { name: /IP \/ 主机/ })).toBeVisible()
  await expect(page.getByRole("tab", { name: /端口 \/ 服务/ })).toBeVisible()
})

test("project overview links to dedicated results and context pages", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName, description } = await createProject(page)

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 15_000 })
  await expect(page.locator("h1", { hasText: projectName })).toBeVisible()
  await expect(page.getByText(description).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "域名 / Web", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "IP / 端口 / 服务", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "漏洞与发现", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "证据与日志", exact: true })).toBeVisible()

  await page.getByRole("link", { name: "域名 / Web", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/results/domains$`))
  await expect(page.getByRole("heading", { name: "域名 / Web 入口" })).toBeVisible()

  await page.goto(`/projects/${projectId}/context`)
  await expect(page.getByRole("heading", { name: "证据与上下文", exact: true })).toBeVisible()
  await expect(page.getByText("当前沉淀概览")).toBeVisible()
})

test("create project routes to the new detail page", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName } = await createProject(page)
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 15_000 })
  await expect(page.locator("h1", { hasText: projectName })).toBeVisible({ timeout: 15_000 })
})

test("settings hub leads into dedicated settings subpages", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings")

  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "设置分类" })).toBeVisible()

  await page.getByRole("link", { name: /MCP 工具管理/ }).first().click()
  await expect(page).toHaveURL(/\/settings\/mcp-tools$/)
  await expect(page.getByRole("heading", { name: "MCP 工具管理" })).toBeVisible()
})

test("project operations page can generate a local orchestrator plan", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}/operations`)

  await expect(page.getByRole("heading", { name: "任务与调度详情" })).toBeVisible()
  await expect(page.getByText("LLM 编排与本地闭环")).toBeVisible()

  const planResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${projectId}/orchestrator/plan`) &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  )

  await page.getByRole("button", { name: /为 .* 生成计划/ }).first().click()

  const planResponse = await planResponsePromise
  expect(planResponse.ok()).toBe(true)

  await expect(page.getByText(/已为 .* 刷新本地编排计划。/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("最近一次编排计划")).toBeVisible()

  const exportResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${projectId}/report-export`) &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  )
  await page.getByRole("button", { name: "导出项目报告" }).click()
  const exportResponse = await exportResponsePromise
  expect(exportResponse.ok()).toBe(true)

  await expect(page.getByText("最近一次导出结果")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: "导出项目报告" })).toBeVisible()
})
