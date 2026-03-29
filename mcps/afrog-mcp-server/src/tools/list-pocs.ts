import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAfrogStdout } from '../afrog/runner.js';
import type { PocEntry } from '../mappers/types.js';

function parseListOutput(stdout: string): PocEntry[] {
  const lines = stdout.split('\n').filter((line) => line.trim());
  const pocs: PocEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // afrog -list outputs lines like: [severity] poc-id (poc-name)
    // or: poc-id [severity] poc-name
    // Try multiple patterns
    const bracketMatch = trimmed.match(/\[(\w+)\]\s+(\S+)\s+(.+)/);
    if (bracketMatch) {
      pocs.push({
        severity: bracketMatch[1].toLowerCase(),
        id: bracketMatch[2],
        name: bracketMatch[3].trim(),
      });
      continue;
    }

    // Fallback: id [severity] name
    const altMatch = trimmed.match(/^(\S+)\s+\[(\w+)\]\s+(.+)/);
    if (altMatch) {
      pocs.push({
        id: altMatch[1],
        severity: altMatch[2].toLowerCase(),
        name: altMatch[3].trim(),
      });
      continue;
    }

    // Simple fallback: treat whole line as id if it looks like a POC
    if (trimmed.match(/^(CVE|CNVD|cve|cnvd|poc-|POC-)/i)) {
      pocs.push({
        id: trimmed,
        name: trimmed,
        severity: 'info',
      });
    }
  }

  return pocs;
}

export function registerListPocs(server: McpServer) {
  server.tool(
    'afrog_list_pocs',
    'List available POCs (vulnerability checks) in afrog',
    {
      keyword: z.string().optional().describe('Search keyword to filter POCs'),
      severity: z
        .enum(['info', 'low', 'medium', 'high', 'critical'])
        .optional()
        .describe('Filter by severity level'),
    },
    async ({ keyword, severity }) => {
      const args = ['-poc-list'];

      if (keyword) args.push('-search', keyword);
      if (severity) args.push('-severity', severity);

      const stdout = await runAfrogStdout({ args });
      const pocs = parseListOutput(stdout);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                pocs,
                summary: `Found ${pocs.length} POCs`,
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

export { parseListOutput };
