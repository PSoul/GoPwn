import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerHostDiscovery } from './tools/host-discovery.js';
import { registerPortScan } from './tools/port-scan.js';
import { registerServiceBruteforce } from './tools/service-bruteforce.js';
import { registerVulnScan } from './tools/vuln-scan.js';
import { registerWebScan } from './tools/web-scan.js';
import { registerFullScan } from './tools/full-scan.js';

const server = new McpServer({
  name: 'fscan-mcp-server',
  version: '1.0.0',
});

registerHostDiscovery(server);
registerPortScan(server);
registerServiceBruteforce(server);
registerVulnScan(server);
registerWebScan(server);
registerFullScan(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('fscan MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
