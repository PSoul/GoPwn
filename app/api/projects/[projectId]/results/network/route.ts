import { getStoredProjectById, getStoredProjectDetailById } from "@/lib/project-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { projectId } = await params
  const groupTitle = "IP / 端口 / 服务"
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)
  const group = detail?.assetGroups.find((item) => item.title === groupTitle)

  if (!project || !group || !detail) {
    return Response.json({ error: `Project '${projectId}' or network result not found` }, { status: 404 })
  }

  return Response.json({ project, group })
})
