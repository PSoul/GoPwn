import { execFileSync } from 'child_process';

export function locateFscan(): string {
  const envPath = process.env.FSCAN_PATH;
  if (envPath) {
    return envPath;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['fscan'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error(
      'fscan binary not found. Set FSCAN_PATH environment variable or add fscan to PATH.'
    );
  }
}
