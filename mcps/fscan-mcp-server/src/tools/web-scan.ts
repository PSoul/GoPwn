import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToFindings } from '../mappers/findings.js';

export function registerWebScan(server: McpServer) {
  server.tool(
    'fscan_web_scan',
    'Scan web applications for vulnerabilities using POC detection (WebLogic, Struts2, Shiro, etc.)',
    {
      target: z.string().optional().describe('Target IP or CIDR range'),
      url: z.string().optional().describe('Single URL to scan'),
      pocName: z.string().optional().describe('Filter POCs by name, e.g. "weblogic"'),
      cookie: z.string().optional().describe('HTTP Cookie header value'),
      proxy: z.string().optional().describe('HTTP proxy URL, e.g. http://127.0.0.1:8080'),
      full: z.boolean().optional().default(false).describe('Enable full POC scanning (e.g. 100 Shiro keys)'),
      timeout: z.number().optional().default(5).describe('Web timeout in seconds'),
    },
    async ({ target, url, pocName, cookie, proxy, full, timeout }) => {
      if (!target && !url) {
        return {
          content: [{ type: 'text' as const, text: 'Error: either target or url must be provided' }],
          isError: true,
        };
      }

      const args: string[] = ['-wt', String(timeout)];
      if (target) args.push('-h', target);
      if (url) args.push('-u', url);
      if (pocName) args.push('-pocname', pocName);
      if (cookie) args.push('-cookie', cookie);
      if (proxy) args.push('-proxy', proxy);
      if (full) args.push('-full');

      const results = await runFscan({ args, timeoutMs: timeout * 60_000 });
      const findings = mapToFindings(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ findings, summary: `Found ${findings.length} web vulnerabilities` }, null, 2),
          },
        ],
      };
    }
  );
}
