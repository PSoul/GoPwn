import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FofaClient } from '../fofa/api-client.js';
import { mapHostToIntelligence } from '../mappers/intelligence.js';

export function registerHost(server: McpServer) {
  server.tool(
    'fofa_host',
    'Get detailed information about a specific host (IP or domain) from FOFA',
    {
      host: z.string().describe('IP address or domain name'),
    },
    async ({ host }) => {
      const client = new FofaClient();
      const response = await client.host(host);

      if (response.error) {
        return {
          content: [{ type: 'text' as const, text: `FOFA error: ${(response as Record<string, unknown>).errmsg}` }],
          isError: true,
        };
      }

      const intelligence = mapHostToIntelligence(host, response);

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
