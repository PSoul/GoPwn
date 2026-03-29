import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryIcp } from '../icp/api-client.js';

export function registerIcpQuery(server: McpServer) {
  server.tool(
    'icp_query',
    'Query ICP (Internet Content Provider) filing information for a domain (for authorized penetration testing)',
    {
      query: z.string().describe('Domain name to query ICP info for, e.g. example.com'),
      timeout: z.number().optional().default(10000).describe('Timeout in milliseconds'),
    },
    async ({ query, timeout }) => {
      try {
        const intelligence = await queryIcp(query, timeout);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ intelligence }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `ICP query failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
