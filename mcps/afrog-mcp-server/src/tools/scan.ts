import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAfrog } from '../afrog/runner.js';
import { mapToFindings } from '../mappers/findings.js';

export function registerScan(server: McpServer) {
  server.tool(
    'afrog_scan',
    'Run a POC-based vulnerability scan against a target using afrog',
    {
      target: z.string().describe('Target URL or IP address'),
      severity: z
        .enum(['info', 'low', 'medium', 'high', 'critical'])
        .optional()
        .describe('Filter by severity level'),
      pocId: z.string().optional().describe('Specific POC ID to use (e.g. CVE-2021-44228)'),
      pocKeyword: z.string().optional().describe('Search keyword to filter POCs'),
      timeout: z.number().optional().default(10).describe('Timeout in seconds'),
      rateLimit: z.number().optional().default(150).describe('Rate limit for requests'),
    },
    async ({ target, severity, pocId, pocKeyword, timeout, rateLimit }) => {
      const args = ['-t', target];

      if (severity) args.push('-severity', severity);
      if (pocId) args.push('-poc', pocId);
      if (pocKeyword) args.push('-search', pocKeyword);
      if (rateLimit) args.push('-rl', String(rateLimit));

      const results = await runAfrog({ args, timeoutMs: timeout * 10_000 });
      const findings = mapToFindings(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                findings,
                summary: `Found ${findings.length} vulnerabilities on ${target}`,
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
