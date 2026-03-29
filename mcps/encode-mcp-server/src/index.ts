import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerEncodeDecode } from './tools/encode-decode.js';
import { registerHashCompute } from './tools/hash-compute.js';
import { registerCryptoUtil } from './tools/crypto-util.js';

const server = new McpServer({
  name: 'encode-mcp-server',
  version: '1.0.0',
});

registerEncodeDecode(server);
registerHashCompute(server);
registerCryptoUtil(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('encode MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
