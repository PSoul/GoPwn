import { z } from "zod"

export const mcpToolPatchSchema = z
  .object({
    status: z.enum(["启用", "禁用", "异常"]).optional(),
    defaultConcurrency: z.string().trim().min(1).optional(),
    rateLimit: z.string().trim().min(1).optional(),
    timeout: z.string().trim().min(1).optional(),
    retry: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "至少提供一个可更新字段")

export const mcpDispatchSchema = z.object({
  capability: z.string().trim().min(1),
  requestedAction: z.string().trim().min(1),
  target: z.string().trim().min(1),
  riskLevel: z.enum(["高", "中", "低"]),
})

export const mcpWorkflowSmokeSchema = z.object({
  scenario: z.enum(["baseline", "with-approval"]),
})

export const localValidationRunSchema = z.object({
  labId: z.string().trim().min(1),
  approvalScenario: z.enum(["none", "include-high-risk"]).optional(),
})
