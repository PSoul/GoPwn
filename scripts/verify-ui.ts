import { chromium } from "playwright"

const BASE = "http://localhost:3001"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  // Login via API to get session cookie
  console.log("Logging in via API...")
  const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
    data: { account: "admin@company.local", password: "Prototype@2026" },
  })
  console.log("Login status:", loginRes.status())

  // Warm up — visit dashboard first to trigger compilation
  console.log("Warming up...")
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(3000)

  // Go to projects list to find a project ID
  await page.goto(`${BASE}/projects`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: "verify-0-projects.png", fullPage: true })
  console.log("0. Projects list captured")

  // Extract project ID from page HTML
  const html = await page.content()
  const match = html.match(/\/projects\/(c[a-z0-9]+)/)
  if (!match) {
    console.log("No project links found. Page content preview:", html.slice(0, 500))
    await browser.close()
    return
  }
  const projectId = match[1]
  const projectUrl = `${BASE}/projects/${projectId}`
  console.log(`Found project: ${projectId}`)

  // 1. Overview page
  console.log("Loading overview...")
  await page.goto(projectUrl, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "verify-1-overview.png", fullPage: true })
  console.log("1. Overview page captured")

  // 2. Assets page - domains tab
  console.log("Loading assets/domains...")
  await page.goto(`${projectUrl}/assets?tab=domains`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "verify-2-assets-domains.png", fullPage: true })
  console.log("2. Assets domains tab captured")

  // 3. Assets page - hosts tab
  console.log("Loading assets/hosts...")
  await page.goto(`${projectUrl}/assets?tab=hosts`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "verify-3-assets-hosts.png", fullPage: true })
  console.log("3. Assets hosts tab captured")

  // 4. Assets page - web tab
  console.log("Loading assets/web...")
  await page.goto(`${projectUrl}/assets?tab=web`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "verify-4-assets-web.png", fullPage: true })
  console.log("4. Assets web tab captured")

  // 5. Findings page
  console.log("Loading findings...")
  await page.goto(`${projectUrl}/findings`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "verify-5-findings.png", fullPage: true })
  console.log("5. Findings page captured")

  // 6. Click first finding for detail
  const findingRow = page.locator("table tbody tr").first()
  if (await findingRow.count() > 0) {
    await findingRow.click()
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)
    await page.screenshot({ path: "verify-6-finding-detail.png", fullPage: true })
    console.log("6. Finding detail page captured")
  } else {
    console.log("6. No findings to click")
  }

  // 7. Check nav tabs
  const navTabs = await page.locator('nav[role="tablist"] a').allTextContents()
  console.log("Nav tabs:", navTabs)

  await browser.close()
  console.log("Done!")
}

main().catch(console.error)
