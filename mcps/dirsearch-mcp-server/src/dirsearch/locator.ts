import { execFileSync } from 'child_process';

export function locateDirsearch(): string {
  const envPath = process.env.DIRSEARCH_PATH;
  if (envPath) {
    return envPath;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['dirsearch'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error(
      'dirsearch binary not found. Set DIRSEARCH_PATH environment variable or add dirsearch to PATH.'
    );
  }
}
