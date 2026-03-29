import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendHttpRequest } from '../../src/http/client.js';

describe('sendHttpRequest', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends a GET request and returns response', async () => {
    const mockHeaders = new Headers({ 'content-type': 'text/plain' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: mockHeaders,
        text: () => Promise.resolve('hello world'),
      })
    );

    const result = await sendHttpRequest({ url: 'http://example.com' });

    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toBe('text/plain');
    expect(result.body).toBe('hello world');
    expect(result.timing.total).toBeGreaterThanOrEqual(0);
  });

  it('sends POST with body and custom headers', async () => {
    const mockHeaders = new Headers({ 'content-type': 'application/json' });
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      headers: mockHeaders,
      text: () => Promise.resolve('{"id":1}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendHttpRequest({
      url: 'http://example.com/api',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"test"}',
    });

    expect(result.statusCode).toBe(201);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"test"}',
      })
    );
  });

  it('truncates body larger than 1MB', async () => {
    const largeBody = 'x'.repeat(1_048_577);
    const mockHeaders = new Headers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: mockHeaders,
        text: () => Promise.resolve(largeBody),
      })
    );

    const result = await sendHttpRequest({ url: 'http://example.com/large' });

    expect(result.body.endsWith('\n[truncated]')).toBe(true);
    expect(result.body.length).toBe(1_048_576 + '\n[truncated]'.length);
  });

  it('respects followRedirects=false', async () => {
    const mockHeaders = new Headers({ location: 'http://example.com/new' });
    const mockFetch = vi.fn().mockResolvedValue({
      status: 301,
      headers: mockHeaders,
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendHttpRequest({
      url: 'http://example.com/old',
      followRedirects: false,
    });

    expect(result.statusCode).toBe(301);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com/old',
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('throws on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      )
    );

    await expect(
      sendHttpRequest({ url: 'http://example.com/slow', timeout: 0.1 })
    ).rejects.toThrow();
  });
});
