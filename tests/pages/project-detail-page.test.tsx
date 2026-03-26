import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ProjectDetailPage from "@/app/(console)/projects/[projectId]/page"

describe("ProjectDetailPage", () => {
  it("shows the project flow hub sections", async () => {
    render(await ProjectDetailPage({ params: Promise.resolve({ projectId: "proj-yunlan" }) }))

    expect(screen.getByText("云岚医械公网暴露面验证")).toBeInTheDocument()
    expect(screen.getByText("回流提示")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "任务与调度" })).toBeInTheDocument()
  })
})
