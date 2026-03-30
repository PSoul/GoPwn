import { listStoredProjectFindings } from "@/lib/project-results-repository"
import { listStoredProjects } from "@/lib/project-repository"
import { withApiHandler } from "@/lib/api-handler"
import type { VulnCenterSummaryPayload } from "@/lib/prototype-types"

export const GET = withApiHandler(async () => {
  const projects = await listStoredProjects()
  const allFindings = await listStoredProjectFindings()

  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]))

  const findingsWithProject = allFindings.map((f) => ({
    ...f,
    projectName: projectNameMap.get(f.projectId) ?? "未知项目",
  }))

  const bySeverity: Record<string, number> = {}
  let pendingVerification = 0

  for (const f of allFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    if (f.status === "待验证") {
      pendingVerification++
    }
  }

  const payload: VulnCenterSummaryPayload = {
    total: allFindings.length,
    bySeverity,
    pendingVerification,
    findings: findingsWithProject,
  }

  return Response.json(payload)
})
