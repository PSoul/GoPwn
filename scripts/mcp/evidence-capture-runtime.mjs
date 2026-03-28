import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright"

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 960,
}

function summarizeHtml(html) {
  return html.replace(/\s+/g, " ").trim().slice(0, 320)
}

export async function capturePageEvidence({
  targetUrl,
  screenshotPath,
  htmlPath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fullPage = true,
}) {
  const browser = await chromium.launch({
    headless: true,
  })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: DEFAULT_VIEWPORT,
  })
  const page = await context.newPage()

  try {
    const response = await page.goto(targetUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded",
    })

    try {
      await page.waitForLoadState("networkidle", {
        timeout: Math.min(timeoutMs, 5_000),
      })
    } catch {
      // Some targets keep background requests open forever; keep the latest stable state instead.
    }

    await page.waitForTimeout(400)

    const html = await page.content()
    const screenshot = await page.screenshot({
      animations: "disabled",
      fullPage,
      type: "png",
    })

    await mkdir(path.dirname(screenshotPath), { recursive: true })
    await mkdir(path.dirname(htmlPath), { recursive: true })
    await writeFile(screenshotPath, screenshot)
    await writeFile(htmlPath, html, "utf8")

    return {
      finalUrl: page.url(),
      pageTitle: (await page.title()) || "Untitled",
      statusCode: response?.status() ?? 0,
      contentType: response?.headers()["content-type"] ?? "",
      htmlPreview: summarizeHtml(html),
    }
  } finally {
    await context.close()
    await browser.close()
  }
}
