import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectReportExportPanel } from "@/components/projects/project-report-export-panel"
import type { ProjectReportExportPayload } from "@/lib/prototype-types"

const initialPayload: ProjectReportExportPayload = {
  finalConclusion: null,
  latest: null,
  totalExports: 0,
}

describe("ProjectReportExportPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("triggers report export and renders the latest export digest", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        dispatch: {
          run: {
            id: "run-report-1",
            status: "已执行",
          },
        },
        reportExport: {
          latest: {
            id: "report-run-report-1",
            projectId: "proj-report",
            runId: "run-report-1",
            exportedAt: "2026-03-27 20:30",
            summary: "项目报告摘要已导出：资产 5 条；证据 3 条；漏洞 1 条",
            digestLines: ["资产 5 条", "证据 3 条", "漏洞 1 条"],
            assetCount: 5,
            evidenceCount: 3,
            findingCount: 1,
            conclusionGeneratedAt: "2026-03-27 20:31",
            conclusionSource: "reviewer",
            conclusionSummary: "最终结论：当前项目已完成首轮收束。",
          },
          totalExports: 1,
          finalConclusion: {
            id: "conclusion-proj-report",
            projectId: "proj-report",
            generatedAt: "2026-03-27 20:31",
            source: "reviewer",
            summary: "最终结论：当前项目已完成首轮收束。",
            keyPoints: ["资产 5 条", "证据 3 条", "漏洞 1 条"],
            nextActions: ["整理修复建议并归档结果。"],
            assetCount: 5,
            evidenceCount: 3,
            findingCount: 1,
          },
        },
      }),
    } as Response)

    render(<ProjectReportExportPanel projectId="proj-report" initialPayload={initialPayload} />)

    fireEvent.click(screen.getByRole("button", { name: "导出项目报告" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/projects/proj-report/report-export", {
        method: "POST",
      })
    })

    await waitFor(() => {
      expect(screen.getByText("报告导出已完成，最新结果已回流。")).toBeInTheDocument()
      expect(screen.getByText("资产 5 条")).toBeInTheDocument()
      expect(screen.getByText("证据 3 条")).toBeInTheDocument()
      expect(screen.getByText("漏洞 1 条")).toBeInTheDocument()
      expect(screen.getByText("最终结论：当前项目已完成首轮收束。")).toBeInTheDocument()
    })
  })
})
