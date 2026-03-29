import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTcpConnect } from './tools/tcp-connect.js';
import { registerUdpSend } from './tools/udp-send.js';
import { registerBannerGrab } from './tools/banner-grab.js';

const server = new McpServer({
  name: 'netcat-mcp-server',
  version: '1.0.0',
});

registerTcpConnect(server);
registerUdpSend(server);
registerBannerGrab(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('netcat MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
