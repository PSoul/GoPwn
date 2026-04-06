import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

test("sidebar shows updated navigation terminology", async ({ page }) => {
  await loginAsResearcher(page)

  // "发现" section should exist
  await expect(page.getByText("发现", { exact: true }).first()).toBeVisible()
  // "漏洞中心" nav item
  await expect(page.getByRole("link", { name: "漏洞中心" })).toBeVisible()
})

test("vuln center page loads and shows stats cards", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/vuln-center")

  await expect(page.getByRole("heading", { name: "漏洞中心" })).toBeVisible()
  // Stats or empty state should render
  await expect(page.getByText("漏洞总数").first()).toBeVisible({ timeout: 10_000 })
})

test("/evidence returns 404 (page removed)", async ({ page }) => {
  await loginAsResearcher(page)
  const response = await page.goto("/evidence")
  expect(response?.status()).toBe(404)
})

test("project list renders card grid layout", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/projects")

  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible()
  // Summary stats should be visible
  await expect(page.getByText("筛选结果")).toBeVisible()
  await expect(page.getByText("阻塞项目")).toBeVisible()
  // Search bar
  await expect(
    page.getByPlaceholder("搜索项目名称、项目编号或项目说明..."),
  ).toBeVisible()
})

test("project workspace shows overview with security and asset sections", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), {
    timeout: 15_000,
  })

  // Workspace tabs (from project-workspace-nav.tsx)
  await expect(page.getByRole("tab", { name: "概览" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "资产" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "漏洞" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "执行控制" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "AI 日志" })).toBeVisible()

  // Overview content sections
  await expect(page.getByRole("heading", { name: "安全发现" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "资产发现" })).toBeVisible()
})

test("AI chat widget is present and toggleable", async ({ page }) => {
  await loginAsResearcher(page)

  // Navigate to a simple page to avoid HMR disruption on dashboard
  await page.goto("/projects")
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible({
    timeout: 10_000,
  })

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

  // Chat panel should show the "AI 思考日志" heading
  await expect(page.getByText("AI 思考日志")).toBeVisible()

  // Minimize button
  await minimizeButton.click()
  // Widget should collapse back to button
  await expect(widgetButton).toBeVisible({ timeout: 10_000 })
})
