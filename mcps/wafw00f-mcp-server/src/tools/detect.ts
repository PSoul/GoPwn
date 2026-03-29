import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runWafw00f } from '../wafw00f/runner.js';
import { mapToFindings } from '../mappers/findings.js';

export function registerDetect(server: McpServer) {
  server.tool(
    'wafw00f_detect',
    'Detect Web Application Firewalls (WAFs) protecting a target URL using wafw00f',
    {
      url: z.string().describe('Target URL to check for WAF'),
      findAll: z.boolean().optional().default(false).describe('Check all possible WAFs instead of stopping at first match'),
      timeout: z.number().optional().default(30).describe('Timeout in seconds'),
    },
    async ({ url, findAll, timeout }) => {
      const args = [url];

      if (findAll) args.push('-a');

      const results = await runWafw00f({ args, timeoutMs: timeout * 1_000 });
      const findings = mapToFindings(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                findings,
                summary: `Checked ${url}: ${findings.filter((f) => f.evidence.detected).length} WAF(s) detected`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
