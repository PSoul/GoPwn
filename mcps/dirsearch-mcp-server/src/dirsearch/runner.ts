import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateDirsearch } from './locator.js';
import { parseDirsearchOutput } from '../parsers/json-parser.js';
import type { DirsearchResult } from '../mappers/types.js';

export interface RunDirsearchOptions {
  args: string[];
  timeoutMs?: number;
}

export async function runDirsearch(options: RunDirsearchOptions): Promise<DirsearchResult[]> {
  const dirsearchPath = locateDirsearch();
  const tmpFile = join(tmpdir(), `dirsearch-${randomUUID()}.json`);

  const fullArgs = [...options.args, '--format', 'json', '-o', tmpFile];

  return new Promise((resolve, reject) => {
    const child = execFile(
      dirsearchPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`dirsearch failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseDirsearchOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[dirsearch stderr] ${data.toString()}`);
    });
  });
}
