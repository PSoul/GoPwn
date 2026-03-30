import { localFoundationalConnectors } from "@/lib/mcp-connectors/local-foundational-connectors"
import { realDnsIntelligenceConnector } from "@/lib/mcp-connectors/real-dns-intelligence-connector"
import { realEvidenceCaptureMcpConnector } from "@/lib/mcp-connectors/real-evidence-capture-mcp-connector"
import { realHttpStructureMcpConnector } from "@/lib/mcp-connectors/real-http-structure-mcp-connector"
import { realHttpValidationMcpConnector } from "@/lib/mcp-connectors/real-http-validation-mcp-connector"
import { realWebSurfaceMcpConnector } from "@/lib/mcp-connectors/real-web-surface-mcp-connector"
import { stdioMcpConnector } from "@/lib/mcp-connectors/stdio-mcp-connector"
import type { McpConnector, McpConnectorExecutionContext } from "@/lib/mcp-connectors/types"

const orderedConnectors: McpConnector[] = [
  stdioMcpConnector,
  realDnsIntelligenceConnector,
  realEvidenceCaptureMcpConnector,
  realHttpStructureMcpConnector,
  realHttpValidationMcpConnector,
  realWebSurfaceMcpConnector,
  ...localFoundationalConnectors,
]

export function listRegisteredMcpConnectors() {
  return orderedConnectors
}

export async function resolveMcpConnector(context: McpConnectorExecutionContext) {
  for (const connector of orderedConnectors) {
    if (await connector.supports(context)) {
      return connector
    }
  }
  return null
}
