import { z } from "zod"

import type { LlmProfileId } from "@/lib/prototype-types"

const profileIdEnum = z.enum(["orchestrator", "reviewer", "analyzer"] satisfies [LlmProfileId, ...LlmProfileId[]])

export const llmProfileWriteSchema = z
  .object({
    id: profileIdEnum,
    provider: z.string().trim().min(1),
    label: z.string().trim().min(1),
    apiKey: z.string().trim(),
    baseUrl: z.string().trim(),
    model: z.string().trim(),
    timeoutMs: z.number().int().min(1000).max(120000),
    temperature: z.number().min(0).max(2),
    enabled: z.boolean(),
    contextWindowSize: z.number().int().min(4096).max(2000000).default(65536),
  })
  .superRefine((value, context) => {
    if (!value.enabled) {
      return
    }

    if (!value.apiKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "apiKey is required when the profile is enabled.",
        path: ["apiKey"],
      })
    }

    if (!value.baseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "baseUrl is required when the profile is enabled.",
        path: ["baseUrl"],
      })
    }

    if (!value.model) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "model is required when the profile is enabled.",
        path: ["model"],
      })
    }
  })

export type LlmProfileWriteInput = z.infer<typeof llmProfileWriteSchema>
