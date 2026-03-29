import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { locateFscan } from '../../src/fscan/locator.js';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('locateFscan', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns FSCAN_PATH when env var is set', () => {
    process.env.FSCAN_PATH = '/usr/local/bin/fscan';
    expect(locateFscan()).toBe('/usr/local/bin/fscan');
  });

  it('falls back to which/where on PATH', () => {
    delete process.env.FSCAN_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockReturnValue(Buffer.from('/usr/bin/fscan\n'));
    const result = locateFscan();
    expect(result).toBe('/usr/bin/fscan');
  });

  it('throws when fscan is not found', () => {
    delete process.env.FSCAN_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockImplementation(() => { throw new Error('not found'); });
    expect(() => locateFscan()).toThrow('fscan binary not found');
  });
});
