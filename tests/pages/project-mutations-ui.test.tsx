import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectForm } from "@/components/projects/project-form"
import { ProjectListClient } from "@/components/projects/project-list-client"
import { defaultProjectFormPreset } from "@/lib/settings/platform-config"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

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

  it("renders the simplified project form with only name, target input, and description", () => {
    render(<ProjectForm mode="create" preset={defaultProjectFormPreset as never} />)

    expect(screen.getByLabelText("项目名称")).toBeInTheDocument()
    expect(screen.getByLabelText("目标")).toBeInTheDocument()
    expect(screen.getByLabelText("项目说明")).toBeInTheDocument()
    expect(screen.queryByLabelText("负责人")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("授权说明")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("审批模式")).not.toBeInTheDocument()
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

    render(<ProjectForm mode="create" preset={defaultProjectFormPreset as never} />)

    fireEvent.change(screen.getByLabelText("项目名称"), {
      target: { value: "新项目" },
    })
    fireEvent.change(screen.getByLabelText("目标"), {
      target: { value: "example.com\n10.10.10.10" },
    })
    fireEvent.change(screen.getByLabelText("项目说明"), {
      target: { value: "用于验证最小项目输入。" },
    })

    fireEvent.click(screen.getByRole("button", { name: "创建项目" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "新项目",
            targetInput: "example.com\n10.10.10.10",
            description: "用于验证最小项目输入。",
            approvalMode: "default",
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/projects/proj-new")
    })
  })

  it("archives a project from the list through the archive api", async () => {
    const fixture = await createStoredProjectFixture()

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          ...fixture.project,
          openTasks: 0,
          pendingApprovals: 0,
          stage: "报告与回归验证",
          status: "已完成",
        },
      }),
    } as Response)

    render(<ProjectListClient projects={[fixture.project]} />)

    fireEvent.click(screen.getByRole("button", { name: "归档" }))
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${fixture.project.id}/archive`,
        expect.objectContaining({
          method: "POST",
        }),
      )
    })
  })
})
