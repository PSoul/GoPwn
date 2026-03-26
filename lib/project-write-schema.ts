import { z } from "zod"

export const projectMutationSchema = z.object({
  name: z.string().trim().min(1),
  seed: z.string().trim().min(1),
  targetType: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  priority: z.enum(["高", "中", "低"]),
  targetSummary: z.string().trim().min(1),
  authorizationSummary: z.string().trim().min(1),
  scopeSummary: z.string().trim().min(1),
  forbiddenActions: z.string().trim().min(1),
  defaultConcurrency: z.string().trim().min(1),
  rateLimit: z.string().trim().min(1),
  timeout: z.string().trim().min(1),
  approvalMode: z.string().trim().min(1),
  tags: z.string().trim().min(1),
  deliveryNotes: z.string().trim().min(1),
})

export const projectPatchSchema = projectMutationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "至少提供一个可更新字段")
