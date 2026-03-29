/**
 * read_file — 读取文件内容
 *
 * 让 LLM 可以读取执行结果文件、配置文件、日志等。
 */
import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export function registerReadFile(server: McpServer) {
  server.tool(
    'read_file',
    'Read a file from the filesystem. Useful for reading script outputs, config files, or analysis results.',
    {
      path: z.string().describe('Absolute or relative path to the file'),
      encoding: z.enum(['utf-8', 'base64', 'hex']).optional().default('utf-8').describe('File encoding'),
      max_bytes: z.number().optional().default(MAX_FILE_SIZE).describe('Maximum bytes to read'),
    },
    async ({ path, encoding, max_bytes }) => {
      try {
        const buffer = await readFile(path);
        const maxBytes = Math.min(max_bytes ?? MAX_FILE_SIZE, MAX_FILE_SIZE);
        const truncated = buffer.length > maxBytes;
        const content = buffer.slice(0, maxBytes);

        let text: string;

        if (encoding === 'base64') {
          text = content.toString('base64');
        } else if (encoding === 'hex') {
          text = content.toString('hex');
        } else {
          text = content.toString('utf-8');
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                path,
                size: buffer.length,
                truncated,
                encoding,
                content: text,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `文件读取失败: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
