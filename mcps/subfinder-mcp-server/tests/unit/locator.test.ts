import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { locateSubfinder } from '../../src/subfinder/locator.js';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('locateSubfinder', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns SUBFINDER_PATH when env var is set', () => {
    process.env.SUBFINDER_PATH = '/usr/local/bin/subfinder';
    expect(locateSubfinder()).toBe('/usr/local/bin/subfinder');
  });

  it('falls back to which/where on PATH', () => {
    delete process.env.SUBFINDER_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockReturnValue(Buffer.from('/usr/bin/subfinder\n'));
    const result = locateSubfinder();
    expect(result).toBe('/usr/bin/subfinder');
  });

  it('throws when subfinder is not found', () => {
    delete process.env.SUBFINDER_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockImplementation(() => { throw new Error('not found'); });
    expect(() => locateSubfinder()).toThrow('subfinder binary not found');
  });
});
