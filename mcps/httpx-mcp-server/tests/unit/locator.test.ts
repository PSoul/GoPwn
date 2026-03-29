import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { locateHttpx } from '../../src/httpx/locator.js';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('locateHttpx', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns HTTPX_PATH when env var is set', () => {
    process.env.HTTPX_PATH = '/usr/local/bin/httpx';
    expect(locateHttpx()).toBe('/usr/local/bin/httpx');
  });

  it('falls back to which/where on PATH', () => {
    delete process.env.HTTPX_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockReturnValue(Buffer.from('/usr/bin/httpx\n'));
    const result = locateHttpx();
    expect(result).toBe('/usr/bin/httpx');
  });

  it('throws when httpx is not found', () => {
    delete process.env.HTTPX_PATH;
    const mockExec = vi.mocked(execFileSync);
    mockExec.mockImplementation(() => { throw new Error('not found'); });
    expect(() => locateHttpx()).toThrow('httpx binary not found');
  });
});
