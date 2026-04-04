import { apiHandler, json } from "@/lib/infra/api-handler"
import * as approvalService from "@/lib/services/approval-service"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const approvals = await approvalService.listByProject(projectId)
  return json(approvals)
})
