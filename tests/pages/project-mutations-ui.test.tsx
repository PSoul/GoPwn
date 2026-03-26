import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectForm } from "@/components/projects/project-form"
import { ProjectListClient } from "@/components/projects/project-list-client"
import { defaultProjectFormPreset, projects } from "@/lib/prototype-data"

const push = vi.fn()
const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}))

describe("Project mutation ui", () => {
  beforeEach(() => {
    push.mockReset()
    refresh.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("submits the create form to the projects api and routes to the new detail page", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          id: "proj-new",
        },
      }),
    } as Response)

    render(<ProjectForm mode="create" preset={defaultProjectFormPreset} />)

    fireEvent.click(screen.getByRole("button", { name: "创建项目" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/projects/proj-new")
    })
  })

  it("archives a project from the list through the archive api", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          ...projects[0],
          openTasks: 0,
          pendingApprovals: 0,
          stage: "报告与回归验证",
          status: "已完成",
          tags: [...projects[0].tags, "已归档"],
        },
      }),
    } as Response)

    render(<ProjectListClient projects={[projects[0]]} />)

    fireEvent.click(screen.getByRole("button", { name: "归档" }))
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${projects[0].id}/archive`,
        expect.objectContaining({
          method: "POST",
        }),
      )
    })
  })
})
