import { execFileSync } from 'child_process';

export function locateWafw00f(): string {
  const envPath = process.env.WAFW00F_PATH;
  if (envPath) return envPath;

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['wafw00f'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error('wafw00f binary not found. Set WAFW00F_PATH environment variable or add wafw00f to PATH.');
  }
}
