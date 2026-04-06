/**
 * MCP tool → OpenAI function definition conversion.
 * Bridges MCP tool schemas (stored in DB as JSON Schema) to the
 * OpenAI chat completion `functions` parameter format.
 */

import type { OpenAIFunctionDef } from "./provider"

type McpToolRecord = {
  toolName: string
  description: string
  inputSchema: unknown
}

export function mcpToolToFunction(tool: McpToolRecord): OpenAIFunctionDef {
  const schema = (tool.inputSchema ?? {}) as Record<string, unknown>
  const parameters: Record<string, unknown> = {
    type: "object",
    properties: schema.properties ?? {},
    ...(schema.required ? { required: schema.required } : {}),
  }
  return {
    name: tool.toolName,
    description: tool.description || `MCP tool: ${tool.toolName}`,
    parameters,
  }
}

export function mcpToolsToFunctions(tools: McpToolRecord[]): OpenAIFunctionDef[] {
  return tools.map(mcpToolToFunction)
}

export function getControlFunctions(): OpenAIFunctionDef[] {
  return [
    {
      name: "done",
      description: "结束当前轮次的测试。当你认为当前阶段的测试已充分完成，或没有更多有价值的测试可做时调用。",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "本轮测试的总结：做了什么、发现了什么、建议下一步方向" },
          phase_suggestion: {
            type: "string",
            enum: ["recon", "discovery", "assessment", "verification", "reporting"],
            description: "建议下一轮进入的测试阶段（可选）",
          },
        },
        required: ["summary"],
      },
    },
    {
      name: "report_finding",
      description: "直接报告一个安全发现/漏洞。当你确认发现了一个安全问题时调用。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "发现的标题，简洁描述问题" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"], description: "严重程度" },
          target: { type: "string", description: "受影响的目标（IP、域名、URL 等）" },
          detail: { type: "string", description: "详细描述：问题是什么、如何发现的、潜在影响" },
          recommendation: { type: "string", description: "修复建议" },
        },
        required: ["title", "severity", "target", "detail"],
      },
    },
  ]
}
