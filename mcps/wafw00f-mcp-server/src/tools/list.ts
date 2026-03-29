import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runWafw00fStdout } from '../wafw00f/runner.js';

export interface WafEntry {
  name: string;
  manufacturer: string;
}

export function parseListOutput(stdout: string): WafEntry[] {
  const lines = stdout.split('\n').filter((line) => line.trim());
  const wafs: WafEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // wafw00f -l outputs lines like: Name (Manufacturer)
    // or: Name                          Manufacturer
    // Skip header/separator lines
    if (trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.toLowerCase().startsWith('can detect')) {
      continue;
    }

    // Pattern: Name (Manufacturer)
    const parenMatch = trimmed.match(/^(.+?)\s+\((.+?)\)\s*$/);
    if (parenMatch) {
      wafs.push({
        name: parenMatch[1].trim(),
        manufacturer: parenMatch[2].trim(),
      });
      continue;
    }

    // Pattern: tabular format with multiple spaces as separator
    const tabMatch = trimmed.match(/^(\S.+?)\s{2,}(\S.+)$/);
    if (tabMatch) {
      wafs.push({
        name: tabMatch[1].trim(),
        manufacturer: tabMatch[2].trim(),
      });
      continue;
    }

    // Fallback: treat non-empty line as WAF name only
    if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      wafs.push({
        name: trimmed,
        manufacturer: '',
      });
    }
  }

  return wafs;
}

export function registerList(server: McpServer) {
  server.tool(
    'wafw00f_list',
    'List all WAFs that wafw00f can detect',
    {},
    async () => {
      const stdout = await runWafw00fStdout({ args: ['-l'] });
      const wafs = parseListOutput(stdout);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                wafs,
                summary: `wafw00f can detect ${wafs.length} WAFs`,
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
