import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCodeSearch } from './tools/code-search.js';
import { registerRepoSearch } from './tools/repo-search.js';
import { registerCommitSearch } from './tools/commit-search.js';

const server = new McpServer({
  name: 'github-recon-mcp-server',
  version: '1.0.0',
});

registerCodeSearch(server);
registerRepoSearch(server);
registerCommitSearch(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('github-recon MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
