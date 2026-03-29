import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FofaClient } from '../fofa/api-client.js';
import { mapStatsToIntelligence } from '../mappers/intelligence.js';

export function registerStats(server: McpServer) {
  server.tool(
    'fofa_stats',
    'Get aggregated statistics for a FOFA query',
    {
      query: z.string().describe('FOFA search query'),
      statsFields: z
        .array(z.string())
        .optional()
        .default(['title', 'country'])
        .describe('Fields to aggregate statistics on'),
    },
    async ({ query, statsFields }) => {
      const client = new FofaClient();
      const response = await client.stats(query, statsFields);

      if ((response as { error?: boolean }).error) {
        return {
          content: [{ type: 'text' as const, text: `FOFA error: ${(response as { errmsg?: string }).errmsg}` }],
          isError: true,
        };
      }

      const intelligence = mapStatsToIntelligence(query, response);

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
