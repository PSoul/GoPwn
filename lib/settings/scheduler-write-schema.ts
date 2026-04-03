import { z } from "zod"

export const projectSchedulerControlPatchSchema = z
  .object({
    lifecycle: z.enum(["idle", "running", "paused", "stopped"]).optional(),
    paused: z.boolean().optional(),
    autoReplan: z.boolean().optional(),
    maxRounds: z.number().int().min(1).max(50).optional(),
    note: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "至少提供一个可更新字段")

export const projectSchedulerTaskActionSchema = z.object({
  action: z.enum(["cancel", "retry"]),
  note: z.string().trim().min(1).optional(),
})
