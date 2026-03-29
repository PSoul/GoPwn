import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryDomainWhois } from '../whois/client.js';
import { parseDomainWhois } from '../whois/parser.js';

export function registerWhoisQuery(server: McpServer) {
  server.tool(
    'whois_query',
    'Query WHOIS information for a domain name (for authorized penetration testing)',
    {
      domain: z.string().describe('Domain name to query, e.g. example.com'),
      server: z.string().optional().describe('Custom WHOIS server to use'),
      timeout: z.number().optional().default(10000).describe('Timeout in milliseconds'),
    },
    async ({ domain, server: whoisServer, timeout }) => {
      try {
        const raw = await queryDomainWhois(domain, {
          server: whoisServer,
          timeout,
        });

        const result = parseDomainWhois(raw);

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
              text: `WHOIS query failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
