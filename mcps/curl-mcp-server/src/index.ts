import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerHttpRequest } from './tools/request.js';
import { registerRawRequest } from './tools/raw-request.js';
import { registerHttpBatch } from './tools/batch.js';

const server = new McpServer({
  name: 'curl-mcp-server',
  version: '1.0.0',
});

registerHttpRequest(server);
registerRawRequest(server);
registerHttpBatch(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('curl MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
