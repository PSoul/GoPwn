import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToFindings } from '../mappers/findings.js';

export function registerVulnScan(server: McpServer) {
  server.tool(
    'fscan_vuln_scan',
    'Scan for known vulnerabilities (MS17-010, SMBGhost, etc.) on target hosts',
    {
      target: z.string().describe('Target IP or CIDR range'),
      vulnType: z.enum(['ms17010', 'smbghost']).optional().describe('Specific vulnerability to scan for'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
    },
    async ({ target, vulnType, timeout }) => {
      const mode = vulnType ?? 'ms17010';
      const args = ['-h', target, '-m', mode, '-time', String(timeout), '-nobr', '-nopoc'];

      const results = await runFscan({ args, timeoutMs: timeout * 10_000 });
      const findings = mapToFindings(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ findings, summary: `Found ${findings.length} vulnerabilities` }, null, 2),
          },
        ],
      };
    }
  );
}
