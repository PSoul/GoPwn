import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { locateDirsearch } from '../../src/dirsearch/locator.js';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('locateDirsearch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns DIRSEARCH_PATH when env var is set', () => {
    process.env.DIRSEARCH_PATH = '/usr/local/bin/dirsearch';
    expect(locateDirsearch()).toBe('/usr/local/bin/dirsearch');
  });

  it('falls back to which/where on PATH', () => {
    delete process.env.DIRSEARCH_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockReturnValue(Buffer.from('/usr/bin/dirsearch\n'));
    const result = locateDirsearch();
    expect(result).toBe('/usr/bin/dirsearch');
  });

  it('throws when dirsearch is not found', () => {
    delete process.env.DIRSEARCH_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockImplementation(() => { throw new Error('not found'); });
    expect(() => locateDirsearch()).toThrow('dirsearch binary not found');
  });
});
