import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateHttpx } from './locator.js';
import { parseHttpxOutput } from '../parsers/json-parser.js';
import type { HttpxResult } from '../mappers/types.js';

export interface RunHttpxOptions {
  args: string[];
  stdinData: string;
  timeoutMs?: number;
}

export async function runHttpx(options: RunHttpxOptions): Promise<HttpxResult[]> {
  const httpxPath = locateHttpx();
  const tmpFile = join(tmpdir(), `httpx-${randomUUID()}.json`);

  const fullArgs = [...options.args, '-json', '-o', tmpFile];

  return new Promise((resolve, reject) => {
    const child = execFile(
      httpxPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`httpx failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseHttpxOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[httpx stderr] ${data.toString()}`);
    });

    // Write targets to stdin and close it
    if (child.stdin) {
      child.stdin.write(options.stdinData);
      child.stdin.end();
    }
  });
}
