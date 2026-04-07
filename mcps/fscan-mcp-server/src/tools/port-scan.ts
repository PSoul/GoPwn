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
      // fscan 2.0: 端口扫描是默认行为，不需要 -m 参数。用 -nobr -nopoc 跳过暴力破解和 POC 扫描
      const args = ['-h', target, '-t', String(threads), '-time', String(timeout), '-nobr', '-nopoc'];
      if (ports) args.push('-p', ports);

      // 全端口扫描可能耗时较长，根据端口范围动态调整超时
      const isFullRange = ports === '1-65535' || ports === 'all';
      const timeoutMs = isFullRange ? 5 * 60_000 : 3 * 60_000;
      const results = await runFscan({ args, timeoutMs });
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
