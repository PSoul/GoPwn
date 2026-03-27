import { describe, expect, it } from "vitest"

import { GET as getProjectDetail } from "@/app/api/projects/[projectId]/route"
import { GET as getProjects } from "@/app/api/projects/route"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

const buildProjectContext = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
})

describe("projects api routes", () => {
  it("returns the project collection payload", async () => {
    const fixture = createStoredProjectFixture()
    const response = await getProjects()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1)
    expect(payload.items[0].id).toBe(fixture.project.id)
  })

  it("returns a typed overview payload for a project", async () => {
    const fixture = createStoredProjectFixture()
    const response = await getProjectDetail(
      new Request(`http://localhost/api/projects/${fixture.project.id}`),
      buildProjectContext(fixture.project.id),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.project.name).toBe(fixture.project.name)
    expect(payload.detail.currentStage.title).toBe("授权与范围定义")
  })

  it("returns 404 when the project does not exist", async () => {
    const response = await getProjectDetail(new Request("http://localhost/api/projects/unknown"), buildProjectContext("unknown"))
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toContain("unknown")
  })
})
