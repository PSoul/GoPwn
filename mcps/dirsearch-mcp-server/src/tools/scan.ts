import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runDirsearch } from '../dirsearch/runner.js';
import { mapToWebEntries } from '../mappers/web-entries.js';

export function registerScan(server: McpServer) {
  server.tool(
    'dirsearch_scan',
    'Scan a URL for hidden directories and files using dirsearch',
    {
      url: z.string().describe('Target URL to scan'),
      wordlist: z.string().optional().describe('Path to custom wordlist file'),
      extensions: z.string().optional().describe('File extensions to search, e.g. "php,asp"'),
      threads: z.number().optional().default(30).describe('Number of threads'),
      excludeStatus: z.string().optional().describe('Status codes to exclude, e.g. "404,403"'),
      timeout: z.number().optional().default(10).describe('Connection timeout in seconds'),
    },
    async ({ url, wordlist, extensions, threads, excludeStatus, timeout }) => {
      const args: string[] = ['-u', url];

      if (wordlist) args.push('-w', wordlist);
      if (extensions) args.push('-e', extensions);
      if (threads) args.push('-t', String(threads));
      if (excludeStatus) args.push('--exclude-status', excludeStatus);
      if (timeout) args.push('--timeout', String(timeout));

      const results = await runDirsearch({ args, timeoutMs: 5 * 60_000 });
      const entries = mapToWebEntries(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { entries, summary: `Found ${entries.length} paths` },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
