import { expect, test } from "@playwright/test"

async function loginAsResearcher(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.getByLabel("账号").fill("researcher@company.local")
  await page.getByLabel("密码").fill("Prototype@2026")

  // In E2E_TEST_MODE captcha validation is bypassed server-side, so fill any value.
  // Try to read real captcha first; fall back to "TEST" if unavailable (HMR stale state).
  const captchaButton = page.locator("button[title='点击刷新验证码']")
  await expect(captchaButton).toBeVisible({ timeout: 10_000 })
  let captchaCode = "TEST"
  try {
    await expect(captchaButton).toHaveText(/[A-Z0-9]{4}/, { timeout: 5_000 })
    const captchaText = await captchaButton.textContent()
    captchaCode = (captchaText ?? "").match(/[A-Z0-9]{4}/)?.[0] ?? "TEST"
  } catch { /* E2E_TEST_MODE bypasses validation, "TEST" is fine */ }
  await page.getByLabel("验证码").fill(captchaCode)

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

test("sidebar shows updated navigation terminology", async ({ page }) => {
  await loginAsResearcher(page)

  // "发现" section should exist instead of "执行"
  await expect(page.getByText("发现", { exact: true }).first()).toBeVisible()
  // "漏洞中心" nav item should exist instead of "证据与结果"
  await expect(page.getByRole("link", { name: "漏洞中心" })).toBeVisible()
  // "资产中心" still under "发现"
  await expect(page.getByRole("link", { name: "资产中心" })).toBeVisible()
})

test("vuln center page loads and shows stats cards", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/vuln-center")

  await expect(page.getByRole("heading", { name: "漏洞中心" })).toBeVisible()
  // Wait for async data load
  await expect(page.getByText("漏洞总数")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("高危").first()).toBeVisible()
  await expect(page.getByText("中危").first()).toBeVisible()
  await expect(page.getByText("低危/情报").first()).toBeVisible()

  // Filters should be visible
  await expect(page.getByPlaceholder("搜索漏洞标题、影响面、项目...")).toBeVisible()

  // Evidence archive collapsible
  await expect(page.getByText("执行证据归档")).toBeVisible()
})

test("/evidence redirects to /vuln-center", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/evidence")
  await expect(page).toHaveURL(/\/vuln-center$/, { timeout: 10_000 })
})

test("project list renders card grid layout", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/projects")

  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()
  // Summary stats should be visible
  await expect(page.getByText("筛选结果")).toBeVisible()
  await expect(page.getByText("阻塞项目")).toBeVisible()
  await expect(page.getByText("审批压力")).toBeVisible()
  // Search bar
  await expect(page.getByPlaceholder("搜索项目名称、目标、项目编号或项目说明...")).toBeVisible()
})

test("project workspace shows AI 日志 tab and renamed 上下文 tab", async ({ page }) => {
  await loginAsResearcher(page)

  // Create a project first
  await page.goto("/projects/new")
  const suffix = Date.now().toString()
  await page.getByLabel("项目名称").fill(`E2E Cockpit ${suffix}`)
  await page.getByLabel("目标").fill("http://127.0.0.1:18080")
  await page.getByLabel("项目说明").fill("Cockpit redesign E2E test")

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

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 15_000 })

  // Check renamed tab: "上下文" instead of "证据"
  await expect(page.getByRole("tab", { name: "上下文" })).toBeVisible()

  // Check new tab: "AI 日志"
  await expect(page.getByRole("tab", { name: "AI 日志" })).toBeVisible()

  // Navigate to AI logs tab (tab switch, URL stays on project page)
  await page.getByRole("tab", { name: "AI 日志" }).click()
  // The AI 日志 tab should now be selected
  const aiLogTab = page.getByRole("tab", { name: "AI 日志" })
  await expect(aiLogTab).toBeVisible()
  await expect(aiLogTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 })
})

test("AI chat widget is present and toggleable", async ({ page }) => {
  await loginAsResearcher(page)

  // Navigate to a simple page to avoid HMR disruption on dashboard
  await page.goto("/approvals")
  await expect(page.getByRole("heading", { name: "审批中心" })).toBeVisible({ timeout: 10_000 })

  // Wait for page to settle (HMR/compilation)
  await page.waitForTimeout(1000)

  // Chat widget button should be visible (bottom-right)
  const widgetButton = page.getByLabel("打开 AI 对话日志")
  await expect(widgetButton).toBeVisible({ timeout: 10_000 })

  // Click to expand
  await widgetButton.click()

  // Widget panel should be visible (wait for React state update)
  const minimizeButton = page.getByLabel("最小化")
  await expect(minimizeButton).toBeVisible({ timeout: 10_000 })

  // Role filter tab buttons (use getByRole("button") to avoid matching <span> role badges)
  await expect(page.getByRole("button", { name: "全部", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "编排", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "审阅", exact: true })).toBeVisible()

  // Minimize button
  await minimizeButton.click()
  // Widget should collapse back to button
  await expect(widgetButton).toBeVisible({ timeout: 10_000 })
})
