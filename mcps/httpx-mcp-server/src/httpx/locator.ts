import { execFileSync } from 'child_process';

export function locateHttpx(): string {
  const envPath = process.env.HTTPX_PATH;
  if (envPath) {
    return envPath;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['httpx'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error(
      'httpx binary not found. Set HTTPX_PATH environment variable or add httpx to PATH.'
    );
  }
}
