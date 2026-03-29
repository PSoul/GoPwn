import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryIpWhois } from '../whois/client.js';
import { parseIpWhois } from '../whois/parser.js';

export function registerWhoisIp(server: McpServer) {
  server.tool(
    'whois_ip',
    'Query WHOIS information for an IP address (for authorized penetration testing)',
    {
      ip: z.string().describe('IP address to query, e.g. 8.8.8.8'),
      timeout: z.number().optional().default(10000).describe('Timeout in milliseconds'),
    },
    async ({ ip, timeout }) => {
      try {
        const raw = await queryIpWhois(ip, { timeout });
        const result = parseIpWhois(raw);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `WHOIS IP query failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
