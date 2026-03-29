import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateAfrog } from './locator.js';
import { parseAfrogOutput } from '../parsers/json-parser.js';
import type { AfrogResult } from '../mappers/types.js';

export interface RunAfrogOptions {
  args: string[];
  timeoutMs?: number;
}

export interface RunAfrogStdoutOptions {
  args: string[];
  timeoutMs?: number;
}

export async function runAfrog(options: RunAfrogOptions): Promise<AfrogResult[]> {
  const afrogPath = locateAfrog();
  const tmpFile = join(tmpdir(), `afrog-${randomUUID()}.json`);

  const fullArgs = [...options.args, '-j', tmpFile];

  return new Promise((resolve, reject) => {
    const child = execFile(
      afrogPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`afrog failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseAfrogOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[afrog stderr] ${data.toString()}`);
    });
  });
}

export async function runAfrogStdout(options: RunAfrogStdoutOptions): Promise<string> {
  const afrogPath = locateAfrog();

  return new Promise((resolve, reject) => {
    const child = execFile(
      afrogPath,
      options.args,
      { timeout: options.timeoutMs ?? 60_000, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`afrog failed: ${error.message}`));
          return;
        }
        resolve(stdout || stderr || '');
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[afrog stderr] ${data.toString()}`);
    });
  });
}
