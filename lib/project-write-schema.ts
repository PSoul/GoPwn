import { z } from "zod"

export const projectMutationSchema = z.object({
  name: z.string().trim().min(1),
  targetInput: z.string().trim().min(1),
  description: z.string().trim().min(1),
})

export const projectPatchSchema = projectMutationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "至少提供一个可更新字段")
