import { runProjectSchedulerTaskActionPayload } from "@/lib/prototype-api"
import { projectSchedulerTaskActionSchema } from "@/lib/scheduler-write-schema"
import { withApiHandler } from "@/lib/api-handler"

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId, taskId } = await params
  const body = await request.json()
  const parsed = projectSchedulerTaskActionSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project scheduler-task payload" }, { status: 400 })
  }

  const payload = await runProjectSchedulerTaskActionPayload(projectId, taskId, parsed.data.action, parsed.data.note)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' or task '${taskId}' not found` }, { status: 404 })
  }

  return Response.json(payload)
})
