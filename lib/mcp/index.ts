/**
 * MCP module entry point.
 */

export type { McpConnector, McpToolInput, McpToolResult } from "./connector"
export { createStdioConnector } from "./stdio-connector"
export { callTool, syncToolsFromServers, closeAll } from "./registry"
