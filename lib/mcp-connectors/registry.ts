import { localFoundationalConnectors } from "@/lib/mcp-connectors/local-foundational-connectors"
import { realDnsIntelligenceConnector } from "@/lib/mcp-connectors/real-dns-intelligence-connector"
import { realHttpStructureMcpConnector } from "@/lib/mcp-connectors/real-http-structure-mcp-connector"
import { realWebSurfaceMcpConnector } from "@/lib/mcp-connectors/real-web-surface-mcp-connector"
import type { McpConnector, McpConnectorExecutionContext } from "@/lib/mcp-connectors/types"

const orderedConnectors: McpConnector[] = [
  realDnsIntelligenceConnector,
  realHttpStructureMcpConnector,
  realWebSurfaceMcpConnector,
  ...localFoundationalConnectors,
]

export function listRegisteredMcpConnectors() {
  return orderedConnectors
}

export function resolveMcpConnector(context: McpConnectorExecutionContext) {
  return orderedConnectors.find((connector) => connector.supports(context)) ?? null
}
