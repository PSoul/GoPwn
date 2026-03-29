import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runHttpx } from '../httpx/runner.js';
import { mapToWebEntries } from '../mappers/web-entries.js';

export function registerProbe(server: McpServer) {
  server.tool(
    'httpx_probe',
    'Probe web targets for alive detection — returns status codes, titles, servers, and content lengths',
    {
      targets: z.array(z.string()).describe('List of target URLs or hosts to probe'),
      ports: z.string().optional().describe('Comma-separated ports to probe, e.g. "80,443,8080"'),
      threads: z.number().optional().default(50).describe('Number of concurrent threads'),
      timeout: z.number().optional().default(5).describe('Timeout in seconds per request'),
    },
    async ({ targets, ports, threads, timeout }) => {
      const args: string[] = [];
      if (ports) args.push('-p', ports);
      args.push('-t', String(threads));
      args.push('-timeout', String(timeout));

      const stdinData = targets.join('\n') + '\n';
      const results = await runHttpx({ args, stdinData, timeoutMs: timeout * targets.length * 1000 + 30_000 });
      const entries = mapToWebEntries(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ webEntries: entries, summary: `Probed ${entries.length} alive web targets` }, null, 2),
          },
        ],
      };
    }
  );
}
