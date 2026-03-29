import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerWhoisQuery } from './tools/whois-query.js';
import { registerWhoisIp } from './tools/whois-ip.js';
import { registerIcpQuery } from './tools/icp-query.js';

const server = new McpServer({
  name: 'whois-mcp-server',
  version: '1.0.0',
});

registerWhoisQuery(server);
registerWhoisIp(server);
registerIcpQuery(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('whois MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
