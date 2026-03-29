import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runSubfinder } from '../subfinder/runner.js';
import { mapToDomains } from '../mappers/domains.js';

export function registerEnum(server: McpServer) {
  server.tool(
    'subfinder_enum',
    'Passive subdomain enumeration for a target domain',
    {
      target: z.string().describe('Target domain, e.g. example.com'),
      sources: z.array(z.string()).optional().describe('Specific sources to use, e.g. ["crtsh","virustotal"]'),
      recursive: z.boolean().optional().default(false).describe('Enable recursive subdomain enumeration'),
      timeout: z.number().optional().default(30).describe('Timeout in seconds'),
    },
    async ({ target, sources, recursive, timeout }) => {
      const args = ['-d', target];
      if (sources && sources.length > 0) args.push('-s', sources.join(','));
      if (recursive) args.push('-recursive');
      args.push('-timeout', String(timeout));

      const results = await runSubfinder({ args, timeoutMs: timeout * 2_000 });
      const domains = mapToDomains(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ domains, summary: `Found ${domains.length} unique subdomains for ${target}` }, null, 2),
          },
        ],
      };
    }
  );
}
