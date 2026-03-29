import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToAssets } from '../mappers/assets.js';

export function registerHostDiscovery(server: McpServer) {
  server.tool(
    'fscan_host_discovery',
    'Discover alive hosts in a network range using ICMP/ping scanning',
    {
      target: z.string().describe('Target IP or CIDR range, e.g. 192.168.1.0/24'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
      noPing: z.boolean().optional().default(false).describe('Skip ping, use ICMP directly'),
    },
    async ({ target, timeout, noPing }) => {
      const args = ['-h', target, '-m', 'icmp', '-time', String(timeout), '-nobr', '-nopoc'];
      if (noPing) args.push('-np');

      const results = await runFscan({ args, timeoutMs: timeout * 10_000 });
      const assets = mapToAssets(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ assets, summary: `Found ${assets.filter((a) => a.alive).length} alive hosts` }, null, 2),
          },
        ],
      };
    }
  );
}
