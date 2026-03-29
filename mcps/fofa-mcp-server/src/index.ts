import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSearch } from './tools/search.js';
import { registerHost } from './tools/host.js';
import { registerStats } from './tools/stats.js';

const server = new McpServer({
  name: 'fofa-mcp-server',
  version: '1.0.0',
});

registerSearch(server);
registerHost(server);
registerStats(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('fofa MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
