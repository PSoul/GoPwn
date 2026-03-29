import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runDirsearch } from '../dirsearch/runner.js';
import { mapToWebEntries } from '../mappers/web-entries.js';

export function registerRecursive(server: McpServer) {
  server.tool(
    'dirsearch_recursive',
    'Recursively scan a URL for directories and files using dirsearch',
    {
      url: z.string().describe('Target URL to scan'),
      depth: z.number().optional().default(2).describe('Maximum recursion depth'),
      wordlist: z.string().optional().describe('Path to custom wordlist file'),
      extensions: z.string().optional().describe('File extensions to search, e.g. "php,asp"'),
      timeout: z.number().optional().default(10).describe('Connection timeout in seconds'),
    },
    async ({ url, depth, wordlist, extensions, timeout }) => {
      const args: string[] = ['-u', url, '-r', '--max-recursion-depth', String(depth)];

      if (wordlist) args.push('-w', wordlist);
      if (extensions) args.push('-e', extensions);
      if (timeout) args.push('--timeout', String(timeout));

      const results = await runDirsearch({ args, timeoutMs: 10 * 60_000 });
      const entries = mapToWebEntries(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { entries, summary: `Found ${entries.length} paths (recursive, depth ${depth})` },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
