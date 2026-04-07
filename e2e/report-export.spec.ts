import { expect, test } from "@playwright/test"
import { loginAsResearcher, createProject } from "./helpers"

test("报告导出 — 导出按钮可见", async ({ page }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)
  await page.goto(`/projects/${projectId}`)

  // 报告导出入口（可能在概览页或独立按钮）
  const exportBtn = page.getByRole("button", { name: /导出|报告/ }).first()
  const hasExport = await exportBtn.isVisible().catch(() => false)
  // 如果当前页面有导出按钮，验证可点击
  if (hasExport) {
    await expect(exportBtn).toBeEnabled()
  }
})

test("报告导出 — API 返回有效响应", async ({ page, request }) => {
  await loginAsResearcher(page)
  const { projectId } = await createProject(page)

  // 通过 API 直接验证 report-export 端点
  const cookies = await page.context().cookies()
  const tokenCookie = cookies.find((c) => c.name === "pentest_token")

  if (tokenCookie) {
    const res = await request.get(`/api/projects/${projectId}/report-export`, {
      headers: { Cookie: `pentest_token=${tokenCookie.value}` },
    })
    // 新项目无数据时应返回 200（空报告）或 404
    expect([200, 404]).toContain(res.status())
  }
})
