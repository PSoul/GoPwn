import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { locateFscan } from './locator.js';
import { parseFscanOutput } from '../parsers/json-parser.js';
import type { ScanResult } from '../mappers/types.js';

export interface RunFscanOptions {
  args: string[];
  timeoutMs?: number;
}

export async function runFscan(options: RunFscanOptions): Promise<ScanResult[]> {
  const fscanPath = locateFscan();
  const tmpFile = join(tmpdir(), `fscan-${randomUUID()}.json`);

  const fullArgs = [...options.args, '-json', '-o', tmpFile, '-nocolor'];

  return new Promise((resolve, reject) => {
    const child = execFile(
      fscanPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        try {
          // fscan may exit with non-zero even on partial success, still try to read output
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              reject(new Error(`fscan failed: ${error.message}`));
              return;
            }
            resolve([]);
            return;
          }

          const results = parseFscanOutput(raw);
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        } finally {
          unlink(tmpFile).catch(() => {});
        }
      }
    );

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[fscan stderr] ${data.toString()}`);
    });
  });
}
