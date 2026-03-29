import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProbe } from './tools/probe.js';
import { registerTechDetect } from './tools/tech-detect.js';

const server = new McpServer({
  name: 'httpx-mcp-server',
  version: '1.0.0',
});

registerProbe(server);
registerTechDetect(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('httpx MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
