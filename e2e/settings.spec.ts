/**
 * Settings Page E2E Tests
 *
 * Verifies that the settings hub and each sub-page loads correctly.
 */
import { expect, test } from "@playwright/test"
import { loginAsResearcher } from "./helpers"

test("settings hub renders category grid and status preview", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings")

  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "设置分类" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "系统状态预览" })).toBeVisible()

  // Category links should be present (use .first() to avoid strict mode on duplicate links)
  await expect(page.getByRole("link", { name: /LLM 模型/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /探测工具/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /审批策略/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /审计日志/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /系统状态/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /用户管理/ }).first()).toBeVisible()
})

test("LLM settings page loads", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/llm")

  await expect(page.getByRole("heading", { name: "LLM 设置" })).toBeVisible()
  await expect(page.getByText("模型接入与角色分工")).toBeVisible()
})

test("MCP tools page loads and shows gateway view", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/mcp-tools")

  await expect(
    page.getByRole("heading", { name: "探测工具管理" }),
  ).toBeVisible()
  await expect(page.getByText("MCP 网关视图")).toBeVisible()
})

test("approval policy page loads", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/approval-policy")

  await expect(
    page.getByRole("heading", { name: "审批策略" }),
  ).toBeVisible()
  await expect(page.getByText("审批与范围控制")).toBeVisible()
})

test("audit logs page loads", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/audit-logs")

  await expect(
    page.getByRole("heading", { name: "审计日志" }),
  ).toBeVisible()
  await expect(page.getByText("审计事件")).toBeVisible()
})

test("system status page loads", async ({ page }) => {
  await loginAsResearcher(page)
  await page.goto("/settings/system-status")

  await expect(
    page.getByRole("heading", { name: "系统状态" }),
  ).toBeVisible()
  await expect(page.getByText("平台健康状态")).toBeVisible()
})
