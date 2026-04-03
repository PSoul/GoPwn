import { z } from "zod"

import { MCP_BOUNDARY_TYPES, MCP_CAPABILITY_NAMES, MCP_RESULT_MAPPINGS, MCP_RISK_LEVELS, MCP_TRANSPORTS } from "@/lib/settings/platform-config"

const jsonSchemaLikeObject = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, "schema object cannot be empty")
  .refine(
    (value) =>
      typeof value.type === "string" ||
      typeof value.$schema === "string" ||
      "properties" in value ||
      "items" in value ||
      "oneOf" in value ||
      "anyOf" in value ||
      "allOf" in value,
    "schema must resemble a JSON schema object",
  )

export const mcpToolRegistrationSchema = z.object({
  toolName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  version: z.string().trim().min(1),
  capability: z.enum(MCP_CAPABILITY_NAMES),
  boundary: z.enum(MCP_BOUNDARY_TYPES),
  riskLevel: z.enum(MCP_RISK_LEVELS),
  requiresApproval: z.boolean(),
  resultMappings: z.array(z.enum(MCP_RESULT_MAPPINGS)).min(1),
  inputSchema: jsonSchemaLikeObject,
  outputSchema: jsonSchemaLikeObject,
  defaultConcurrency: z.string().trim().min(1),
  rateLimit: z.string().trim().min(1),
  timeout: z.string().trim().min(1),
  retry: z.string().trim().min(1),
  owner: z.string().trim().min(1),
})

export const mcpServerRegistrationSchema = z
  .object({
    serverName: z.string().trim().min(1),
    version: z.string().trim().min(1),
    transport: z.enum(MCP_TRANSPORTS),
    command: z.string().trim().optional(),
    args: z.array(z.string().trim()).default([]),
    endpoint: z.string().trim().min(1).optional(),
    enabled: z.boolean(),
    notes: z.string().trim().optional(),
    tools: z.array(mcpToolRegistrationSchema).min(1),
  })
  .superRefine((value, context) => {
    if (value.transport === "stdio" && !value.command) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "command is required when transport is stdio",
        path: ["command"],
      })
    }

    const toolNames = new Set<string>()

    for (const [index, tool] of value.tools.entries()) {
      if (toolNames.has(tool.toolName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "toolName must be unique within a server registration",
          path: ["tools", index, "toolName"],
        })
      }

      toolNames.add(tool.toolName)
    }
  })

export type McpServerRegistrationInput = z.infer<typeof mcpServerRegistrationSchema>
