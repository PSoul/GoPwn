import { apiHandler, json } from "@/lib/infra/api-handler"
import * as evidenceRepo from "@/lib/repositories/evidence-repo"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const evidence = await evidenceRepo.findByProject(projectId)
  return json(evidence)
})
