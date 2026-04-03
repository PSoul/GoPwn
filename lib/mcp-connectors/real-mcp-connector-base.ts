import { callMcpServerTool } from "@/lib/mcp-client-service"
import { resolveLocalLabHttpTarget } from "@/lib/local-lab-catalog"
import { createExecutionAbortError, isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import { getProjectPrimaryTarget } from "@/lib/project-targets"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

type LocalLabTarget = ReturnType<typeof resolveLocalLabHttpTarget>

export function isHttpTarget(target: string) {
  return /^https?:\/\//i.test(target)
}

export function resolveTarget(context: McpConnectorExecutionContext) {
  return context.run.target || getProjectPrimaryTarget(context.project)
}

export interface RealMcpConnectorSpec<TStructured extends Record<string, unknown>> {
  connectorKey: string
  label: string
  mcpToolName: string
  supportsCheck: (context: McpConnectorExecutionContext, target: string) => boolean | Promise<boolean>
  buildArguments: (target: string, localLab: LocalLabTarget, context: McpConnectorExecutionContext) => Record<string, unknown>
  buildSuccess: (
    structured: TStructured,
    target: string,
    localLab: LocalLabTarget,
    context: McpConnectorExecutionContext,
  ) => Pick<Extract<McpConnectorResult, { status: "succeeded" }>, "outputs" | "rawOutput" | "structuredContent" | "summaryLines">
}

export function createRealMcpConnector<TStructured extends Record<string, unknown>>(spec: RealMcpConnectorSpec<TStructured>): McpConnector {
  return {
    key: spec.connectorKey,
    mode: "real",

    supports: async (context) => {
      const target = resolveTarget(context)
      const baseCheck = await spec.supportsCheck(context, target)
      if (!baseCheck) return false
      return Boolean(await findStoredEnabledMcpServerByToolBinding(context.run.toolName))
    },

    async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
      throwIfExecutionAborted(context.signal)

      const target = resolveTarget(context)
      const server = await findStoredEnabledMcpServerByToolBinding(context.run.toolName)

      if (!server) {
        return {
          status: "failed",
          connectorKey: spec.connectorKey,
          mode: "real",
          errorMessage: `未找到可用的${spec.label} MCP server。`,
          summaryLines: [`真实${spec.label} MCP server 尚未连接。`],
        }
      }

      try {
        const localLab = resolveLocalLabHttpTarget(target)
        const result = await callMcpServerTool<TStructured>({
          server,
          toolName: spec.mcpToolName,
          arguments: spec.buildArguments(target, localLab, context),
          signal: context.signal,
          target,
        })
        const success = spec.buildSuccess(result.structuredContent, target, localLab, context)

        return {
          status: "succeeded",
          connectorKey: spec.connectorKey,
          mode: "real",
          ...success,
        }
      } catch (error) {
        if (isExecutionAbortError(error) || context.signal?.aborted) {
          throw createExecutionAbortError(error)
        }

        return {
          status: "retryable_failure",
          connectorKey: spec.connectorKey,
          mode: "real",
          errorMessage: error instanceof Error ? error.message : `真实${spec.label}失败。`,
          summaryLines: [`真实${spec.label}失败，已保留为可重试状态。`],
          retryAfterMinutes: 5,
        }
      }
    },
  }
}
