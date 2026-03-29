import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerScan } from './tools/scan.js';
import { registerListPocs } from './tools/list-pocs.js';

const server = new McpServer({
  name: 'afrog-mcp-server',
  version: '1.0.0',
});

registerScan(server);
registerListPocs(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('afrog MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
