import { getStoredProjectById } from "@/lib/project/project-repository"
import { getStoredProjectReportExportPayload } from "@/lib/project/project-results-repository"
import { dispatchProjectMcpRunAndDrain } from "@/lib/project/project-mcp-dispatch-service"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const payload = await getStoredProjectReportExportPayload(projectId)
  return Response.json(payload)
})

export const POST = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const dispatch = await dispatchProjectMcpRunAndDrain(projectId, {
    capability: "报告导出类",
    requestedAction: "导出项目报告",
    target: project.code,
    riskLevel: "低",
  })

  if (!dispatch) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const reportExport = await getStoredProjectReportExportPayload(projectId)

  const payload = { dispatch, reportExport }

  const status =
    payload.dispatch.approval || ["待审批", "已阻塞", "已延后"].includes(payload.dispatch.run.status)
      ? 202
      : 200

  return Response.json(payload, { status })
})
