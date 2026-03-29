import { createProjectOverviewPayload, listProjectsPayload } from "@/lib/prototype-api"
import { projectMutationSchema } from "@/lib/project-write-schema"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(listProjectsPayload())
})

export const POST = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = projectMutationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project payload" }, { status: 400 })
  }

  return Response.json(createProjectOverviewPayload(parsed.data), { status: 201 })
})
