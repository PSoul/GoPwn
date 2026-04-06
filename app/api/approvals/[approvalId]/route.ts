import { apiHandler, json } from "@/lib/infra/api-handler"
import * as approvalService from "@/lib/services/approval-service"
import type { ApprovalStatus } from "@/lib/generated/prisma"

export const PUT = apiHandler(async (req, ctx) => {
  const { approvalId } = await ctx.params
  const { decision, note } = (await req.json()) as { decision: ApprovalStatus; note?: string }
  const result = await approvalService.decide(approvalId, decision, note)
  return json({ approval: result }, 202)
})

export const PATCH = apiHandler(async (req, ctx) => {
  const { approvalId } = await ctx.params
  const { decision } = (await req.json()) as { decision: ApprovalStatus }
  const result = await approvalService.decide(approvalId, decision)
  return json({ approval: result }, 202)
})
