import type {
  ApprovalRecord,
  McpRunRecord,
  McpToolRecord,
  McpWorkflowSmokePayload,
  ProjectRecord,
} from "@/lib/prototype-types"

export type ConnectorMode = "local" | "real"

export interface McpConnectorExecutionContext {
  approval: ApprovalRecord | null
  priorOutputs: McpWorkflowSmokePayload["outputs"]
  project: ProjectRecord
  run: McpRunRecord
  tool: McpToolRecord | null
}

export type McpConnectorResult =
  | {
      status: "succeeded"
      connectorKey: string
      mode: ConnectorMode
      outputs: Partial<McpWorkflowSmokePayload["outputs"]>
      rawOutput: string[]
      structuredContent: Record<string, unknown>
      summaryLines: string[]
    }
  | {
      status: "retryable_failure" | "failed"
      connectorKey: string
      mode: ConnectorMode
      summaryLines: string[]
      errorMessage: string
      retryAfterMinutes?: number
    }

export interface McpConnector {
  key: string
  mode: ConnectorMode
  supports: (context: McpConnectorExecutionContext) => boolean
  execute: (context: McpConnectorExecutionContext) => Promise<McpConnectorResult> | McpConnectorResult
}
