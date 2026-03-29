import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock child_process before importing locator
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { locateAfrog } from '../../src/afrog/locator.js';

describe('locateAfrog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AFROG_PATH;
  });

  it('returns AFROG_PATH when set', () => {
    process.env.AFROG_PATH = '/usr/local/bin/afrog';
    expect(locateAfrog()).toBe('/usr/local/bin/afrog');
  });

  it('falls back to which/where on PATH', () => {
    vi.mocked(execFileSync).mockReturnValue('/usr/bin/afrog\n');
    const result = locateAfrog();
    expect(result).toBe('/usr/bin/afrog');
  });

  it('throws when afrog is not found', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    expect(() => locateAfrog()).toThrow('afrog binary not found');
  });
});
