import { describe, expect, it } from "vitest"

import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getProjects } from "@/app/api/projects/route"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

describe("projects api routes", () => {
  it("returns the project collection payload", async () => {
    const response = await getProjects()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBeGreaterThan(0)
    expect(payload.items[0].id).toBe("proj-huayao")
  })

  it("returns a typed overview payload for a project", async () => {
    const response = await getProjectDetail(new Request("http://localhost/api/projects/proj-huayao"), buildProjectContext("proj-huayao"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.project.name).toBe("华曜科技匿名外网面梳理")
    expect(payload.detail.currentStage.title).toBe("待验证项生成")
  })

  it("returns 404 when the project does not exist", async () => {
    const response = await getProjectDetail(new Request("http://localhost/api/projects/unknown"), buildProjectContext("unknown"))
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toContain("unknown")
  })
})
