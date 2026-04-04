import { apiHandler, json } from "@/lib/infra/api-handler"
import * as findingRepo from "@/lib/repositories/finding-repo"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const findings = await findingRepo.findByProject(projectId)
  return json(findings)
})
