import { projectSchedulerControlPatchSchema } from "@/lib/scheduler-write-schema"
import { updateProjectSchedulerControlPayload } from "@/lib/api-compositions"
import { withApiHandler } from "@/lib/api-handler"

export const PATCH = withApiHandler(async (request, { params }) => {
  const { projectId } = await params
  const body = await request.json()
  const parsed = projectSchedulerControlPatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project scheduler-control payload" }, { status: 400 })
  }

  const payload = await updateProjectSchedulerControlPayload(projectId, parsed.data)

  if (!payload) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  if ("status" in payload && typeof payload.status === "number" && "error" in payload) {
    return Response.json({ error: payload.error }, { status: payload.status })
  }

  return Response.json(payload)
})
