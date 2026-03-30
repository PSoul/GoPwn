import { createStoredProject, listStoredProjects } from "@/lib/project-repository"
import { projectMutationSchema } from "@/lib/project-write-schema"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const projects = await listStoredProjects()
  return Response.json({ items: projects, total: projects.length })
})

export const POST = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = projectMutationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project payload" }, { status: 400 })
  }

  return Response.json(await createStoredProject(parsed.data), { status: 201 })
})
