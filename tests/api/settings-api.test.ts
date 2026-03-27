import { describe, expect, it } from "vitest"

import { GET as getSettingsSections } from "@/app/api/settings/sections/route"
import { GET as getSystemStatus } from "@/app/api/settings/system-status/route"
import { GET as getWorkLogs } from "@/app/api/settings/work-logs/route"
import { createWorkflowFixture } from "@/tests/helpers/project-fixtures"

describe("settings api routes", () => {
  it("returns settings section summaries", async () => {
    const response = await getSettingsSections()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBeGreaterThan(0)
    expect(payload.items.some((item: { href: string }) => item.href === "/settings/mcp-tools")).toBe(true)
  })

  it("returns system health cards", async () => {
    const response = await getSystemStatus()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBeGreaterThan(0)
    expect(payload.items.some((item: { title: string }) => item.title === "MCP 网关")).toBe(true)
  })

  it("returns persisted work logs", async () => {
    await createWorkflowFixture()
    const response = await getWorkLogs()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBeGreaterThan(0)
    expect(payload.items.some((item: { category: string }) => item.category.length > 0)).toBe(true)
  })
})
