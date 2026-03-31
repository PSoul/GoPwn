/**
 * UI Review Screenshot Script
 *
 * Takes fullPage screenshots of all 27 pages in desktop + mobile viewports.
 * Requires: dev server running on port 4500, database seeded.
 *
 * Usage: node scripts/ui-review-screenshots.mjs
 */

import { chromium } from "@playwright/test"

// Bypass proxy for localhost (Windows corporate proxy issue)
process.env.NO_PROXY = "localhost,127.0.0.1"
process.env.no_proxy = "localhost,127.0.0.1"

const BASE = "http://localhost:4500"
const OUT = "screenshots"
const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

const CREDENTIALS = { username: "researcher@company.local", password: "Prototype@2026" }

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(1000)
  await page.fill('#account', CREDENTIALS.username)
  await page.fill('#password', CREDENTIALS.password)

  // Read captcha from button text, or use "TEST" (E2E_TEST_MODE=true bypasses validation)
  const captchaBtn = page.locator("button[title='点击刷新验证码']")
  let captchaCode = "TEST"
  try {
    await captchaBtn.waitFor({ state: "visible", timeout: 10000 })
    const text = await captchaBtn.textContent()
    const match = (text ?? "").match(/[A-Z0-9]{4}/)
    if (match) captchaCode = match[0]
  } catch {}
  await page.fill('#captcha', captchaCode)

  await page.locator("button:has-text('登录平台')").click()
  await page.waitForURL("**/dashboard", { timeout: 60000 })
}

async function createTestProject(page) {
  // Create a project via API to get a real projectId
  const csrfCookie = (await page.context().cookies()).find(c => c.name === "csrf_token")
  const csrfToken = csrfCookie?.value ?? ""
  const res = await page.evaluate(async ({ base, csrf }) => {
    const r = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        name: "UI审查测试项目",
        targetInput: "example.com\n192.168.1.0/24\nhttps://test.example.com",
        description: "用于 UI/UX 截图审查的测试项目，包含多种目标类型。"
      })
    })
    return r.json()
  }, { base: BASE, csrf: csrfToken })
  return res.project?.id ?? null
}

async function takeScreenshots(page, routes, viewport, suffix) {
  await page.setViewportSize(viewport)
  for (const route of routes) {
    const name = route.path.replace(/\//g, "_").replace(/^_/, "") || "root"
    const fileName = `${OUT}/${name}-${suffix}.png`
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "load", timeout: 60000 })
      // Wait a bit for any animations/lazy content
      await page.waitForTimeout(800)
      await page.screenshot({ path: fileName, fullPage: true })
      console.log(`✓ ${fileName}`)
    } catch (err) {
      console.log(`✗ ${fileName} — ${err.message.slice(0, 80)}`)
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    args: ["--no-proxy-server"],
    headless: true,
  })
  const context = await browser.newContext({ viewport: DESKTOP })
  const page = await context.newPage()

  // Step 1: Screenshot login page (before auth)
  console.log("\n=== Login Page ===")
  // First request triggers compilation — give it extra time
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 120000 })
  await page.waitForTimeout(1500)
  await page.setViewportSize(DESKTOP)
  await page.screenshot({ path: `${OUT}/login-desktop.png`, fullPage: true })
  await page.setViewportSize(MOBILE)
  await page.screenshot({ path: `${OUT}/login-mobile.png`, fullPage: true })
  await page.setViewportSize(DESKTOP)
  console.log("✓ login screenshots")

  // Step 2: Login
  console.log("\n=== Logging in ===")
  await login(page)
  console.log("✓ logged in")

  // Step 3: Create test project
  console.log("\n=== Creating test project ===")
  const projectId = await createTestProject(page)
  console.log(projectId ? `✓ project: ${projectId}` : "✗ project creation failed, using placeholder routes")

  // Step 4: Define all routes
  const staticRoutes = [
    { path: "/dashboard" },
    { path: "/projects" },
    { path: "/projects/new" },
    { path: "/vuln-center" },
    { path: "/assets" },
    { path: "/approvals" },
    { path: "/settings" },
    { path: "/settings/llm" },
    { path: "/settings/mcp-tools" },
    { path: "/settings/users" },
    { path: "/settings/approval-policy" },
    { path: "/settings/audit-logs" },
    { path: "/settings/work-logs" },
    { path: "/settings/system-status" },
  ]

  const projectRoutes = projectId ? [
    { path: `/projects/${projectId}` },
    { path: `/projects/${projectId}/context` },
    { path: `/projects/${projectId}/results/domains` },
    { path: `/projects/${projectId}/results/network` },
    { path: `/projects/${projectId}/results/findings` },
    { path: `/projects/${projectId}/flow` },
    { path: `/projects/${projectId}/operations` },
    { path: `/projects/${projectId}/ai-logs` },
    { path: `/projects/${projectId}/edit` },
  ] : []

  const allRoutes = [...staticRoutes, ...projectRoutes]

  // Step 5: Desktop screenshots
  console.log(`\n=== Desktop (${DESKTOP.width}x${DESKTOP.height}) — ${allRoutes.length} pages ===`)
  await takeScreenshots(page, allRoutes, DESKTOP, "desktop")

  // Step 6: Mobile screenshots
  console.log(`\n=== Mobile (${MOBILE.width}x${MOBILE.height}) — ${allRoutes.length} pages ===`)
  await takeScreenshots(page, allRoutes, MOBILE, "mobile")

  // Step 7: Dark mode — a few key pages
  console.log("\n=== Dark Mode (desktop) ===")
  await page.setViewportSize(DESKTOP)
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  const darkPages = ["/dashboard", "/projects"]
  if (projectId) darkPages.push(`/projects/${projectId}`, `/projects/${projectId}/operations`)
  for (const path of darkPages) {
    const name = path.replace(/\//g, "_").replace(/^_/, "")
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60000 })
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/${name}-dark.png`, fullPage: true })
      console.log(`✓ ${OUT}/${name}-dark.png`)
    } catch (err) {
      console.log(`✗ dark ${path} — ${err.message.slice(0, 80)}`)
    }
  }

  await browser.close()
  console.log("\n=== Done ===")
}

main().catch(console.error)
