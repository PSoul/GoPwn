import { expect, Page } from "@playwright/test"

/**
 * Log in as the seeded E2E researcher user.
 * The login form has: account + password + submit button (no captcha).
 */
export async function loginAsResearcher(page: Page) {
  await page.goto("/login")
  await page.getByLabel("账号").fill("researcher@company.local")
  await page.getByLabel("密码").fill("Prototype@2026")

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

/**
 * Create a new project with the given targets and return its id/name/description.
 * Caller must already be logged in.
 */
export async function createProject(
  page: Page,
  targets = "http://127.0.0.1:18080/WebGoat\n127.0.0.1",
) {
  await page.goto("/projects/new")
  const suffix = Date.now().toString()
  const projectName = `E2E 本地项目 ${suffix}`
  const description = `E2E 验证项目 ${suffix}`

  await page.getByLabel("项目名称").fill(projectName)
  await page.getByLabel("目标").fill(targets)
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

  const payload = (await createResponse.json()) as {
    project?: { id?: string }
  }
  const projectId = payload.project?.id ?? ""

  return { projectId, projectName, description }
}
