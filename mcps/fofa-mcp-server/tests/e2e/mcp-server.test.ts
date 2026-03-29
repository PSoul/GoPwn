import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerSearch } from '../../src/tools/search.js';
import { registerHost } from '../../src/tools/host.js';
import { registerStats } from '../../src/tools/stats.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

async function createTestClient() {
  const server = new McpServer({ name: 'fofa-mcp-server', version: '1.0.0' });
  registerSearch(server);
  registerHost(server);
  registerStats(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('fofa MCP Server E2E', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FOFA_EMAIL = 'test@example.com';
    process.env.FOFA_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('lists all 3 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['fofa_host', 'fofa_search', 'fofa_stats']);
  });

  it('fofa_search returns intelligence', async () => {
    const fixture = loadFixture('search-result.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fofa_search',
      arguments: { query: 'domain="example.com"' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.intelligence.source).toBe('fofa');
    expect(parsed.intelligence.total).toBe(2);
    expect(parsed.intelligence.results).toHaveLength(2);
    expect(parsed.intelligence.results[0].host).toBe('example.com');
  });

  it('fofa_host returns intelligence', async () => {
    const fixture = loadFixture('host-result.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fofa_host',
      arguments: { host: 'example.com' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.intelligence.source).toBe('fofa');
    expect(parsed.intelligence.query).toBe('example.com');
    expect(parsed.intelligence.results[0].ports).toEqual([80, 443, 8080]);
  });

  it('fofa_stats returns intelligence', async () => {
    const mockResponse = { error: false, distinct: { title: [{ name: 'Test', count: 5 }] } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fofa_stats',
      arguments: { query: 'domain="example.com"' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.intelligence.source).toBe('fofa');
    expect(parsed.intelligence.results[0].distinct).toBeDefined();
  });

  it('fofa_search handles API errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: true, errmsg: 'Invalid API key' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fofa_search',
      arguments: { query: 'test' },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain('Invalid API key');
  });
});
