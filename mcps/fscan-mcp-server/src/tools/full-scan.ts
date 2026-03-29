import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToNetwork } from '../mappers/network.js';
import { mapToFindings } from '../mappers/findings.js';
import { mapToAssets } from '../mappers/assets.js';

export function registerFullScan(server: McpServer) {
  server.tool(
    'fscan_full_scan',
    'Run a comprehensive scan including host discovery, port scanning, service detection, brute force, and vulnerability scanning',
    {
      target: z.string().describe('Target IP or CIDR range'),
      ports: z.string().optional().describe('Port range, e.g. "1-65535" or "22,80,443"'),
      threads: z.number().optional().default(600).describe('Number of concurrent threads'),
      noBrute: z.boolean().optional().default(false).describe('Skip credential brute forcing'),
      noPoc: z.boolean().optional().default(false).describe('Skip web POC scanning'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
    },
    async ({ target, ports, threads, noBrute, noPoc, timeout }) => {
      const args = ['-h', target, '-t', String(threads), '-time', String(timeout)];
      if (ports) args.push('-p', ports);
      if (noBrute) args.push('-nobr');
      if (noPoc) args.push('-nopoc');

      const results = await runFscan({ args, timeoutMs: timeout * 30_000 });
      const network = mapToNetwork(results);
      const findings = mapToFindings(results);
      const assets = mapToAssets(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                network,
                findings,
                assets,
                summary: `${assets.length} hosts, ${network.length} open ports, ${findings.length} findings`,
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
