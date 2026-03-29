import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runHttpx } from '../httpx/runner.js';
import { mapToWebEntries } from '../mappers/web-entries.js';

export function registerTechDetect(server: McpServer) {
  server.tool(
    'httpx_tech_detect',
    'Detect technology stacks on web targets — identifies frameworks, servers, and libraries',
    {
      targets: z.array(z.string()).describe('List of target URLs or hosts to scan'),
      timeout: z.number().optional().default(10).describe('Timeout in seconds per request'),
    },
    async ({ targets, timeout }) => {
      const args: string[] = ['-tech-detect', '-timeout', String(timeout)];

      const stdinData = targets.join('\n') + '\n';
      const results = await runHttpx({ args, stdinData, timeoutMs: timeout * targets.length * 1000 + 30_000 });
      const entries = mapToWebEntries(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ webEntries: entries, summary: `Detected technologies on ${entries.length} targets` }, null, 2),
          },
        ],
      };
    }
  );
}
