import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../../src/github/api-client.js';
import codeSearchFixture from '../fixtures/code-search.json';
import repoSearchFixture from '../fixtures/repo-search.json';
import commitSearchFixture from '../fixtures/commit-search.json';

describe('GitHubClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GITHUB_TOKEN;
  });

  function mockFetch(body: unknown, headers?: Record<string, string>) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'X-RateLimit-Remaining': '59',
        'X-RateLimit-Reset': '1700000000',
        ...headers,
      }),
      json: () => Promise.resolve(body),
    });
  }

  it('searchCode sends correct request', async () => {
    mockFetch(codeSearchFixture);
    const client = new GitHubClient();
    const result = await client.searchCode('example.com+password', 30, 1);

    expect(result.total_count).toBe(2);
    expect(result.items).toHaveLength(2);

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain('/search/code?');
    expect(url).toContain('q=example.com%2Bpassword');

    const opts = call[1] as RequestInit;
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer test-token');
    expect(opts.headers).toHaveProperty(
      'Accept',
      'application/vnd.github.text-match+json'
    );
  });

  it('searchRepos sends correct request', async () => {
    mockFetch(repoSearchFixture);
    const client = new GitHubClient();
    const result = await client.searchRepos('testorg', 'stars', 30, 1);

    expect(result.total_count).toBe(2);
    expect(result.items).toHaveLength(2);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/search/repositories?');
    expect(url).toContain('sort=stars');
  });

  it('searchRepos omits sort param for best-match', async () => {
    mockFetch(repoSearchFixture);
    const client = new GitHubClient();
    await client.searchRepos('testorg', 'best-match', 30, 1);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain('sort=');
  });

  it('searchCommits sends correct request with cloak-preview accept', async () => {
    mockFetch(commitSearchFixture);
    const client = new GitHubClient();
    const result = await client.searchCommits('credentials', 'author-date', 30, 1);

    expect(result.total_count).toBe(2);
    expect(result.items).toHaveLength(2);

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain('/search/commits?');
    expect(url).toContain('sort=author-date');

    const opts = call[1] as RequestInit;
    expect(opts.headers).toHaveProperty(
      'Accept',
      'application/vnd.github.cloak-preview+json'
    );
  });

  it('throws on rate limit exceeded', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1700000000',
      }),
      json: () => Promise.resolve({}),
    });

    const client = new GitHubClient();
    await expect(client.searchCode('test', 30, 1)).rejects.toThrow(
      'GitHub API rate limit exceeded'
    );
  });

  it('throws on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': '1700000000',
      }),
    });

    const client = new GitHubClient();
    await expect(client.searchCode('test', 30, 1)).rejects.toThrow(
      'GitHub API error: 403 Forbidden'
    );
  });

  it('works without GITHUB_TOKEN', async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch(codeSearchFixture);
    const client = new GitHubClient();
    await client.searchCode('test', 30, 1);

    const opts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
  });
});
