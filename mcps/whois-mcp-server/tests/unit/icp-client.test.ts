import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

describe('IcpClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('queries ICP with primary API', async () => {
    const fixture = loadFixture('icp-response.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { queryIcp } = await import('../../src/icp/api-client.js');
    const result = await queryIcp('baidu.com');

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('api.vvhan.com');
    expect(url).toContain('info=baidu.com');
    expect(result.source).toBe('icp');
    expect(result.query).toBe('baidu.com');
    expect(result.total).toBe(1);
    expect(result.results[0].unitName).toBe('北京百度网讯科技有限公司');
    expect(result.results[0].icp).toBe('京ICP证030173号-1');
  });

  it('uses custom API URL from env', async () => {
    process.env.ICP_API_URL = 'https://custom-api.example.com/icp';
    const fixture = loadFixture('icp-response.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { queryIcp } = await import('../../src/icp/api-client.js');
    await queryIcp('baidu.com');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('custom-api.example.com');
  });

  it('falls back to backup API on primary failure', async () => {
    delete process.env.ICP_API_URL;
    const fixture = loadFixture('icp-response.json');
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Primary API down'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fixture.info),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { queryIcp } = await import('../../src/icp/api-client.js');
    const result = await queryIcp('baidu.com');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const backupUrl = mockFetch.mock.calls[1][0] as string;
    expect(backupUrl).toContain('66mz8.com');
    expect(result.source).toBe('icp');
  });

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', mockFetch);

    const { queryIcp } = await import('../../src/icp/api-client.js');
    await expect(queryIcp('baidu.com')).rejects.toThrow('ICP API error: 500');
  });

  it('does not fallback when custom URL fails', async () => {
    process.env.ICP_API_URL = 'https://custom-api.example.com/icp';
    const mockFetch = vi.fn().mockRejectedValue(new Error('Custom API down'));
    vi.stubGlobal('fetch', mockFetch);

    const { queryIcp } = await import('../../src/icp/api-client.js');
    await expect(queryIcp('baidu.com')).rejects.toThrow('Custom API down');
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
