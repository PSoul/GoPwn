import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateWafw00f } from './locator.js';
import { parseWafw00fOutput } from '../parsers/json-parser.js';
import type { Wafw00fResult } from '../mappers/types.js';

export interface RunWafw00fOptions {
  args: string[];
  timeoutMs?: number;
}

export interface RunWafw00fStdoutOptions {
  args: string[];
  timeoutMs?: number;
}

export async function runWafw00f(options: RunWafw00fOptions): Promise<Wafw00fResult[]> {
  const wafw00fPath = locateWafw00f();
  const tmpFile = join(tmpdir(), `wafw00f-${randomUUID()}.json`);

  const fullArgs = [...options.args, '-o', tmpFile, '-f', 'json'];

  return new Promise((resolve, reject) => {
    const child = execFile(
      wafw00fPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`wafw00f failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseWafw00fOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[wafw00f stderr] ${data.toString()}`);
    });
  });
}

export async function runWafw00fStdout(options: RunWafw00fStdoutOptions): Promise<string> {
  const wafw00fPath = locateWafw00f();

  return new Promise((resolve, reject) => {
    const child = execFile(
      wafw00fPath,
      options.args,
      { timeout: options.timeoutMs ?? 60_000, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`wafw00f failed: ${error.message}`));
          return;
        }
        resolve(stdout || stderr || '');
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[wafw00f stderr] ${data.toString()}`);
    });
  });
}
