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
  return projectId
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

  await expect(page.getByText("平台控制面")).toBeVisible()
  await expect(page.getByText("今天优先处理")).toBeVisible()

  await page.goto("/projects")

  await expect(page.getByRole("heading", { name: "项目管理" })).toBeVisible()
  await expect(page.getByRole("link", { name: "新建项目" })).toBeVisible()
  await expect(page.getByRole("link", { name: "华曜科技匿名外网面梳理" })).toBeVisible()
})

test("project overview links to dedicated results and context pages", async ({ page }) => {
  await loginAsResearcher(page)
  const projectId = await createProject(page)

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: /项目详情 ·/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "查看证据与上下文" })).toBeVisible()

  await page.getByRole("link", { name: "查看 IP / 端口 / 服务表格" }).click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/results/network$`))
  await expect(page.getByRole("heading", { name: "IP / 端口 / 服务" })).toBeVisible()

  await page.goto(`/projects/${projectId}/context`)
  await expect(page.getByRole("heading", { name: "证据与上下文", exact: true })).toBeVisible()
  await expect(page.getByText("项目证据与上下文")).toBeVisible()
})

test("create project routes to the new detail page", async ({ page }) => {
  await loginAsResearcher(page)
  const projectId = await createProject(page)
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: /项目详情 ·/ })).toBeVisible({ timeout: 15_000 })
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
  const projectId = await createProject(page)
  await page.goto(`/projects/${projectId}/operations`)

  await expect(page.getByRole("heading", { name: "LLM 编排与本地闭环" })).toBeVisible()

  const planResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${projectId}/orchestrator/plan`) &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  )

  await page.getByRole("button", { name: "为 OWASP Juice Shop 生成计划" }).click()

  const planResponse = await planResponsePromise
  expect(planResponse.ok()).toBe(true)

  await expect(page.getByText("已为 OWASP Juice Shop 刷新本地编排计划。")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("标准化本地靶场目标")).toBeVisible()
})
