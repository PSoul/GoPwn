import { execFileSync } from 'child_process';

export function locateAfrog(): string {
  const envPath = process.env.AFROG_PATH;
  if (envPath) {
    return envPath;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(cmd, ['afrog'], { encoding: 'utf-8' });
    return result.toString().trim().split('\n')[0];
  } catch {
    throw new Error(
      'afrog binary not found. Set AFROG_PATH environment variable or add afrog to PATH.'
    );
  }
}
