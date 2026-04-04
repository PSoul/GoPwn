/**
 * MCP connector abstraction.
 * All MCP tool calls go through this interface.
 */

export type McpToolInput = Record<string, unknown>

export type McpToolResult = {
  content: string
  isError: boolean
  durationMs: number
}

export interface McpConnector {
  /**
   * Call an MCP tool by name with given input.
   */
  callTool(toolName: string, input: McpToolInput): Promise<McpToolResult>

  /**
   * List available tools from this connector.
   */
  listTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown }>>

  /**
   * Close the connector and clean up resources.
   */
  close(): Promise<void>
}
