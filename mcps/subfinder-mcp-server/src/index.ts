import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerEnum } from './tools/enum.js';
import { registerVerify } from './tools/verify.js';

const server = new McpServer({
  name: 'subfinder-mcp-server',
  version: '1.0.0',
});

registerEnum(server);
registerVerify(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('subfinder MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
