import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FofaClient } from '../fofa/api-client.js';
import { mapSearchToIntelligence } from '../mappers/intelligence.js';

export function registerSearch(server: McpServer) {
  server.tool(
    'fofa_search',
    'Search FOFA for assets matching a query (FOFA query syntax)',
    {
      query: z.string().describe('FOFA search query, e.g. domain="example.com"'),
      fields: z
        .array(z.string())
        .optional()
        .default(['host', 'ip', 'port', 'title', 'server'])
        .describe('Fields to return'),
      size: z.number().optional().default(100).describe('Number of results per page'),
      page: z.number().optional().default(1).describe('Page number'),
    },
    async ({ query, fields, size, page }) => {
      const client = new FofaClient();
      const response = await client.search(query, fields, size, page);

      if (response.error) {
        return {
          content: [{ type: 'text' as const, text: `FOFA error: ${response.errmsg}` }],
          isError: true,
        };
      }

      const intelligence = mapSearchToIntelligence(query, fields, response);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ intelligence }, null, 2),
          },
        ],
      };
    }
  );
}
