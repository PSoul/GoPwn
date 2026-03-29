import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerExecuteCode } from './tools/execute-code.js';
import { registerExecuteCommand } from './tools/execute-command.js';
import { registerReadFile } from './tools/read-file.js';
import { registerWriteFile } from './tools/write-file.js';

const server = new McpServer({
  name: 'script-mcp-server',
  version: '1.0.0',
});

registerExecuteCode(server);
registerExecuteCommand(server);
registerReadFile(server);
registerWriteFile(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('script MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
