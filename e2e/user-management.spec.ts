import { expect, test } from "@playwright/test"
import { loginAsResearcher } from "./helpers"

test("用户管理页面 — 正常加载", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/users")

  await expect(page.getByRole("heading", { name: /用户管理/ })).toBeVisible({ timeout: 15_000 })
})

test("用户管理页面 — 用户列表展示", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/users")

  // seed 用户 researcher@company.local 应出现在列表中
  await expect(page.getByText("researcher@company.local")).toBeVisible({ timeout: 10_000 })
})

test("用户管理页面 — 从设置入口导航", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings")

  await page.getByRole("link", { name: /用户管理/ }).first().click()
  await expect(page).toHaveURL(/\/settings\/users/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: /用户管理/ })).toBeVisible()
})
