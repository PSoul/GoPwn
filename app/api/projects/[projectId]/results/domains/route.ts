import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const groupTitle = "域名 / Web 入口"
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)
  const group = detail?.assetGroups.find((item) => item.title === groupTitle)

  if (!project || !group || !detail) {
    return Response.json({ error: `Project '${projectId}' or domains result not found` }, { status: 404 })
  }

  return Response.json({ project, group })
})
