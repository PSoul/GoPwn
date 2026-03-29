import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { registerCodeSearch } from '../../src/tools/code-search.js';
import { registerRepoSearch } from '../../src/tools/repo-search.js';
import { registerCommitSearch } from '../../src/tools/commit-search.js';
import codeSearchFixture from '../fixtures/code-search.json';
import repoSearchFixture from '../fixtures/repo-search.json';
import commitSearchFixture from '../fixtures/commit-search.json';

describe('MCP Server E2E', () => {
  let server: McpServer;
  let client: Client;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    process.env.GITHUB_TOKEN = 'test-token';

    server = new McpServer({ name: 'test-server', version: '1.0.0' });
    registerCodeSearch(server);
    registerRepoSearch(server);
    registerCommitSearch(server);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GITHUB_TOKEN;
  });

  function mockFetch(body: unknown) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'X-RateLimit-Remaining': '59',
        'X-RateLimit-Reset': '1700000000',
      }),
      json: () => Promise.resolve(body),
    });
  }

  it('lists all 3 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('github_code_search');
    expect(names).toContain('github_repo_search');
    expect(names).toContain('github_commit_search');
    expect(tools).toHaveLength(3);
  });

  it('github_code_search returns intelligence', async () => {
    mockFetch(codeSearchFixture);

    const result = await client.callTool({
      name: 'github_code_search',
      arguments: { query: 'example.com password', organization: 'testorg' },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.intelligence.source).toBe('github-code');
    expect(parsed.intelligence.total).toBe(2);
    expect(parsed.intelligence.results).toHaveLength(2);
    expect(parsed.intelligence.results[0].repository).toBe('testorg/testrepo');

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('q=example.com+password%2Borg%3Atestorg');
  });

  it('github_repo_search returns intelligence', async () => {
    mockFetch(repoSearchFixture);

    const result = await client.callTool({
      name: 'github_repo_search',
      arguments: { query: 'testorg', sort: 'stars' },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.intelligence.source).toBe('github-repo');
    expect(parsed.intelligence.total).toBe(2);
    expect(parsed.intelligence.results[0].fullName).toBe('testorg/internal-tools');
    expect(parsed.intelligence.results[0].stars).toBe(42);
  });

  it('github_commit_search returns intelligence', async () => {
    mockFetch(commitSearchFixture);

    const result = await client.callTool({
      name: 'github_commit_search',
      arguments: { query: 'credentials', author: 'testuser', sort: 'author-date' },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.intelligence.source).toBe('github-commit');
    expect(parsed.intelligence.total).toBe(2);
    expect(parsed.intelligence.results[0].message).toBe(
      'fix: remove hardcoded credentials from config'
    );

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('sort=author-date');
  });

  it('github_code_search builds query with all filters', async () => {
    mockFetch(codeSearchFixture);

    await client.callTool({
      name: 'github_code_search',
      arguments: {
        query: 'password',
        organization: 'myorg',
        language: 'python',
        filename: '.env',
        extension: 'yml',
      },
    });

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('org%3Amyorg');
    expect(url).toContain('language%3Apython');
    expect(url).toContain('filename%3A.env');
    expect(url).toContain('extension%3Ayml');
  });
});
