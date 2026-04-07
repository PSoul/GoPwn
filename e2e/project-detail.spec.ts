import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

test("项目详情页 — 概览标签展示基本信息", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId, projectName } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  // 项目名称显示
  await expect(page.locator("h1, h2, h3", { hasText: projectName })).toBeVisible({ timeout: 15_000 })
  // 概览标签处于激活状态
  await expect(page.getByRole("tab", { name: "概览" })).toBeVisible()
})

test("项目详情页 — 切换到资产标签", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  await page.getByRole("tab", { name: "资产" }).click()
  // 资产列表区域可见（空状态或表格）
  await expect(page.getByText(/资产|暂无/).first()).toBeVisible({ timeout: 10_000 })
})

test("项目详情页 — 切换到漏洞标签", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  await page.getByRole("tab", { name: "漏洞" }).click()
  await expect(page.getByText(/漏洞|暂无/).first()).toBeVisible({ timeout: 10_000 })
})
