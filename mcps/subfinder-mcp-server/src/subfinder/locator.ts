import { execFileSync } from 'child_process';

export function locateSubfinder(): string {
  const envPath = process.env.SUBFINDER_PATH;
  if (envPath) {
    return envPath;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['subfinder'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error(
      'subfinder binary not found. Set SUBFINDER_PATH environment variable or add subfinder to PATH.'
    );
  }
}
