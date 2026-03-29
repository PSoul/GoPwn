import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

describe('FofaClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FOFA_EMAIL = 'test@example.com';
    process.env.FOFA_KEY = 'test-api-key';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws when FOFA_EMAIL is missing', async () => {
    delete process.env.FOFA_EMAIL;
    const { FofaClient } = await import('../../src/fofa/api-client.js');
    expect(() => new FofaClient()).toThrow('FOFA_EMAIL and FOFA_KEY environment variables are required');
  });

  it('throws when FOFA_KEY is missing', async () => {
    delete process.env.FOFA_KEY;
    const { FofaClient } = await import('../../src/fofa/api-client.js');
    expect(() => new FofaClient()).toThrow('FOFA_EMAIL and FOFA_KEY environment variables are required');
  });

  it('search calls fetch with correct URL', async () => {
    const fixture = loadFixture('search-result.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { FofaClient } = await import('../../src/fofa/api-client.js');
    const client = new FofaClient();
    const result = await client.search('domain="example.com"', ['host', 'ip', 'port'], 100, 1);

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/search/all');
    expect(url).toContain('qbase64=');
    expect(url).toContain('fields=host,ip,port');
    expect(url).toContain('size=100');
    expect(url).toContain('page=1');
    expect(result).toEqual(fixture);
  });

  it('host calls fetch with correct URL', async () => {
    const fixture = loadFixture('host-result.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { FofaClient } = await import('../../src/fofa/api-client.js');
    const client = new FofaClient();
    const result = await client.host('example.com');

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/host/example.com');
    expect(result).toEqual(fixture);
  });

  it('stats calls fetch with correct URL', async () => {
    const mockResponse = { error: false, distinct: { title: [] } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { FofaClient } = await import('../../src/fofa/api-client.js');
    const client = new FofaClient();
    const result = await client.stats('domain="example.com"', ['title', 'country']);

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/search/stats');
    expect(url).toContain('fields=title,country');
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', mockFetch);

    const { FofaClient } = await import('../../src/fofa/api-client.js');
    const client = new FofaClient();
    await expect(client.search('test', ['host'], 10, 1)).rejects.toThrow('FOFA API error: 401');
  });
});
