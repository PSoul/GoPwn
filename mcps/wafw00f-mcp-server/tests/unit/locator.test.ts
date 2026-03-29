import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock child_process before importing locator
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { locateWafw00f } from '../../src/wafw00f/locator.js';

describe('locateWafw00f', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WAFW00F_PATH;
  });

  it('returns WAFW00F_PATH when set', () => {
    process.env.WAFW00F_PATH = '/usr/local/bin/wafw00f';
    expect(locateWafw00f()).toBe('/usr/local/bin/wafw00f');
  });

  it('falls back to which/where on PATH', () => {
    vi.mocked(execFileSync).mockReturnValue('/usr/bin/wafw00f\n');
    const result = locateWafw00f();
    expect(result).toBe('/usr/bin/wafw00f');
  });

  it('throws when wafw00f is not found', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    expect(() => locateWafw00f()).toThrow('wafw00f binary not found');
  });
});
