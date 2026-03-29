import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateSubfinder } from './locator.js';
import { parseSubfinderOutput } from '../parsers/json-parser.js';
import type { SubfinderResult } from '../mappers/types.js';

export interface RunSubfinderOptions {
  args: string[];
  timeoutMs?: number;
}

export async function runSubfinder(options: RunSubfinderOptions): Promise<SubfinderResult[]> {
  const subfinderPath = locateSubfinder();
  const tmpFile = join(tmpdir(), `subfinder-${randomUUID()}.json`);

  const fullArgs = [...options.args, '-oJ', '-o', tmpFile];

  return new Promise((resolve, reject) => {
    const child = execFile(
      subfinderPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`subfinder failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseSubfinderOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[subfinder stderr] ${data.toString()}`);
    });
  });
}
