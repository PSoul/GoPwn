/**
 * write_file — 写入文件
 *
 * 让 LLM 可以保存脚本、攻击载荷、分析结果等到文件系统。
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerWriteFile(server: McpServer) {
  server.tool(
    'write_file',
    'Write content to a file. Useful for saving scripts, payloads, analysis results, or evidence.',
    {
      path: z.string().describe('Path to the file to write'),
      content: z.string().describe('Content to write'),
      encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8').describe('Content encoding'),
      description: z.string().describe('Brief description of what is being written and why'),
    },
    async ({ path, content, encoding, description }) => {
      try {
        // Ensure parent directory exists
        await mkdir(dirname(path), { recursive: true });

        if (encoding === 'base64') {
          await writeFile(path, Buffer.from(content, 'base64'));
        } else {
          await writeFile(path, content, 'utf-8');
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                path,
                bytesWritten: Buffer.byteLength(content, encoding === 'base64' ? 'base64' : 'utf-8'),
                description,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `文件写入失败: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
