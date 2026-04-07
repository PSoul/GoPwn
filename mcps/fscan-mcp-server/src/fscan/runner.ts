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

  const fullArgs = [...options.args, '-o', tmpFile, '-nocolor'];

  return new Promise((resolve, reject) => {
    const stderrChunks: string[] = [];

    const child = execFile(
      fscanPath,
      fullArgs,
      { timeout: options.timeoutMs ?? 300_000, maxBuffer: 50 * 1024 * 1024 },
      async (error) => {
        const stderrOutput = stderrChunks.join('').trim();
        if (stderrOutput) {
          console.error(`[fscan stderr] ${stderrOutput.slice(0, 500)}`);
        }

        try {
          // fscan may exit with non-zero even on partial success, still try to read output
          let raw: string;
          try {
            raw = await readFile(tmpFile, 'utf-8');
          } catch {
            if (error) {
              const detail = stderrOutput ? `${error.message} | stderr: ${stderrOutput.slice(0, 300)}` : error.message;
              reject(new Error(`fscan failed: ${detail}`));
              return;
            }
            // 没有输出文件且无错误 → 返回空结果，但记录 stderr 以供调试
            if (stderrOutput) {
              console.warn(`[fscan] 无输出文件, stderr: ${stderrOutput.slice(0, 300)}`);
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
      stderrChunks.push(data.toString());
    });
  });
}
