import { createProjectOverviewPayload, listProjectsPayload } from "@/lib/prototype-api"
import { projectMutationSchema } from "@/lib/project-write-schema"

export async function GET() {
  return Response.json(listProjectsPayload())
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = projectMutationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid project payload" }, { status: 400 })
  }

  return Response.json(createProjectOverviewPayload(parsed.data), { status: 201 })
}
