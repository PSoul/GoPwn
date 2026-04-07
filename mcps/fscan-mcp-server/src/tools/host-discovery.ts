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
      // fscan 2.0: 没有 icmp 模式，主机发现是默认行为的第一步
      // 用 -nobr -nopoc 限制为仅发现，不做暴力破解和 POC
      const args = ['-h', target, '-time', String(timeout), '-nobr', '-nopoc'];
      if (noPing) args.push('-np');

      const results = await runFscan({ args, timeoutMs: Math.max(timeout * 10_000, 60_000) });
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
