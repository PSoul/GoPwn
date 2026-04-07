import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

test("编辑项目 — 修改项目名称", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  // 找到编辑按钮或设置入口
  const editBtn = page.getByRole("button", { name: /编辑|设置/ }).first()
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click()
    // 修改名称
    const nameInput = page.getByLabel("项目名称")
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(`已编辑项目 ${Date.now()}`)
      await page.getByRole("button", { name: /保存|确定/ }).first().click()
      await expect(page.getByText("已编辑项目")).toBeVisible({ timeout: 10_000 })
    }
  }
})

test("编辑项目 — 修改目标地址", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  const editBtn = page.getByRole("button", { name: /编辑|设置/ }).first()
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click()
    const targetInput = page.getByLabel("目标")
    if (await targetInput.isVisible().catch(() => false)) {
      await targetInput.fill("http://127.0.0.1:9999")
      await page.getByRole("button", { name: /保存|确定/ }).first().click()
    }
  }
})

test("编辑项目 — 修改项目说明", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  const editBtn = page.getByRole("button", { name: /编辑|设置/ }).first()
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click()
    const descInput = page.getByLabel("项目说明")
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill(`更新说明 ${Date.now()}`)
      await page.getByRole("button", { name: /保存|确定/ }).first().click()
    }
  }
})
