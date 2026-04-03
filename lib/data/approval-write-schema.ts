import { z } from "zod"

export const approvalDecisionSchema = z.object({
  decision: z.enum(["待处理", "已批准", "已拒绝", "已延后"]),
})

export const approvalControlPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    autoApproveLowRisk: z.boolean().optional(),
    note: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "至少提供一个可更新字段")
