import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDetect } from './tools/detect.js';
import { registerList } from './tools/list.js';

const server = new McpServer({
  name: 'wafw00f-mcp-server',
  version: '1.0.0',
});

registerDetect(server);
registerList(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('wafw00f MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
