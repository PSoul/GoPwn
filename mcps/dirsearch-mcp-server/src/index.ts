import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerScan } from './tools/scan.js';
import { registerRecursive } from './tools/recursive.js';

const server = new McpServer({
  name: 'dirsearch-mcp-server',
  version: '1.0.0',
});

registerScan(server);
registerRecursive(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('dirsearch MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
