import {
  getProjectReportExportPayload,
  triggerProjectReportExportPayload,
} from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await getProjectReportExportPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})

export const POST = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const payload = await triggerProjectReportExportPayload(projectId)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const status =
    payload.dispatch.approval || ["待审批", "已阻塞", "已延后"].includes(payload.dispatch.run.status)
      ? 202
      : 200

  return Response.json(payload, { status })
})
