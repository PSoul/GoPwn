import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runSubfinder } from '../subfinder/runner.js';
import { mapToDomains } from '../mappers/domains.js';

export function registerVerify(server: McpServer) {
  server.tool(
    'subfinder_verify',
    'Enumerate subdomains and verify with DNS resolution (no wildcard filtering)',
    {
      target: z.string().describe('Target domain, e.g. example.com'),
      resolvers: z.array(z.string()).optional().describe('Custom DNS resolvers, e.g. ["8.8.8.8","1.1.1.1"]'),
      timeout: z.number().optional().default(60).describe('Timeout in seconds'),
    },
    async ({ target, resolvers, timeout }) => {
      const args = ['-d', target, '-nW'];
      if (resolvers && resolvers.length > 0) args.push('-r', resolvers.join(','));
      args.push('-timeout', String(timeout));

      const results = await runSubfinder({ args, timeoutMs: timeout * 2_000 });
      const domains = mapToDomains(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ domains, summary: `Verified ${domains.length} subdomains for ${target}` }, null, 2),
          },
        ],
      };
    }
  );
}
