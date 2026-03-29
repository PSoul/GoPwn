import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToNetwork } from '../mappers/network.js';
import { mapToAssets } from '../mappers/assets.js';

export function registerPortScan(server: McpServer) {
  server.tool(
    'fscan_port_scan',
    'Scan open ports and identify services on target hosts',
    {
      target: z.string().describe('Target IP or CIDR range'),
      ports: z.string().optional().describe('Port range, e.g. "1-65535" or "22,80,443"'),
      threads: z.number().optional().default(600).describe('Number of concurrent threads'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
    },
    async ({ target, ports, threads, timeout }) => {
      const args = ['-h', target, '-m', 'portscan', '-t', String(threads), '-time', String(timeout), '-nobr', '-nopoc'];
      if (ports) args.push('-p', ports);

      const results = await runFscan({ args, timeoutMs: timeout * 10_000 });
      const network = mapToNetwork(results);
      const assets = mapToAssets(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ network, assets, summary: `Found ${network.length} open ports on ${assets.length} hosts` }, null, 2),
          },
        ],
      };
    }
  );
}
