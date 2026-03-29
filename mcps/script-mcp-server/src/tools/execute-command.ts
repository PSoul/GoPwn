/**
 * execute_command — 执行 shell 命令
 *
 * 让 LLM 可以直接调用系统工具（curl, nmap, python, etc.），
 * 类似 Claude Code 的 Bash 工具。
 */
import { exec } from 'node:child_process';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
}

function runCommand(command: string, timeoutMs: number, cwd?: string, env?: Record<string, string>): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startMs = Date.now();

    const child = exec(
      command,
      {
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        cwd: cwd || process.cwd(),
        env: env ? { ...process.env, ...env } : process.env,
        windowsHide: true,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startMs;
        let exitCode: number | null = null;
        let truncated = false;

        if (error) {
          if ('code' in error && error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            truncated = true;
          }
          exitCode = 'code' in error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : 1;
        }

        resolve({
          exitCode: exitCode ?? child.exitCode ?? 0,
          stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
          stderr: stderr.slice(0, MAX_OUTPUT_BYTES / 4),
          durationMs,
          truncated,
        });
      },
    );
  });
}

export function registerExecuteCommand(server: McpServer) {
  server.tool(
    'execute_command',
    'Execute a shell command. Use this to run system tools like curl, nmap, python, dig, etc. Similar to a Bash tool in AI agent frameworks.',
    {
      command: z.string().describe('Shell command to execute'),
      description: z.string().describe('Brief description of what this command does and why'),
      timeout_seconds: z.number().optional().default(30).describe('Execution timeout in seconds (max 300)'),
      cwd: z.string().optional().describe('Working directory for command execution'),
      env: z.record(z.string()).optional().describe('Additional environment variables'),
    },
    async ({ command, description, timeout_seconds, cwd, env }) => {
      const timeoutMs = Math.min((timeout_seconds ?? 30) * 1000, MAX_TIMEOUT_MS);

      try {
        const result = await runCommand(command, timeoutMs, cwd, env);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                exitCode: result.exitCode,
                stdout: result.stdout.trim(),
                stderr: result.stderr.trim(),
                durationMs: result.durationMs,
                truncated: result.truncated,
                description,
                command,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `命令执行异常: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
