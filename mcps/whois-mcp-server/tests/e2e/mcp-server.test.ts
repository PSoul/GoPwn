import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function loadJsonFixture(name: string) {
  return JSON.parse(loadFixture(name));
}

// Mock the whois client module so we don't make real TCP connections
vi.mock('../../src/whois/client.js', () => ({
  queryDomainWhois: vi.fn(),
  queryIpWhois: vi.fn(),
}));

async function createTestClient() {
  const { registerWhoisQuery } = await import('../../src/tools/whois-query.js');
  const { registerWhoisIp } = await import('../../src/tools/whois-ip.js');
  const { registerIcpQuery } = await import('../../src/tools/icp-query.js');

  const server = new McpServer({ name: 'whois-mcp-server', version: '1.0.0' });
  registerWhoisQuery(server);
  registerWhoisIp(server);
  registerIcpQuery(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('whois MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists all 3 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['icp_query', 'whois_ip', 'whois_query']);
  });

  it('whois_query returns parsed domain info', async () => {
    const fixtureData = loadFixture('whois-domain.txt');
    const { queryDomainWhois } = await import('../../src/whois/client.js');
    vi.mocked(queryDomainWhois).mockResolvedValue(fixtureData);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'whois_query',
      arguments: { domain: 'example.com' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.parsed.registrar).toBe('RESERVED-Internet Assigned Numbers Authority');
    expect(parsed.parsed.creationDate).toBe('1995-08-14T04:00:00Z');
    expect(parsed.parsed.nameServers).toContain('a.iana-servers.net');
  });

  it('whois_ip returns parsed IP info', async () => {
    const fixtureData = loadFixture('whois-ip.txt');
    const { queryIpWhois } = await import('../../src/whois/client.js');
    vi.mocked(queryIpWhois).mockResolvedValue(fixtureData);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'whois_ip',
      arguments: { ip: '8.8.8.8' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.parsed.netRange).toBe('8.8.8.0 - 8.8.8.255');
    expect(parsed.parsed.organization).toBe('Google LLC (GOGL)');
    expect(parsed.parsed.country).toBe('US');
    expect(parsed.parsed.asn).toBe('AS15169');
  });

  it('icp_query returns intelligence', async () => {
    const fixture = loadJsonFixture('icp-response.json');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'icp_query',
      arguments: { query: 'baidu.com' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.intelligence.source).toBe('icp');
    expect(parsed.intelligence.query).toBe('baidu.com');
    expect(parsed.intelligence.total).toBe(1);
    expect(parsed.intelligence.results[0].unitName).toBe('北京百度网讯科技有限公司');
  });

  it('whois_query handles connection errors gracefully', async () => {
    const { queryDomainWhois } = await import('../../src/whois/client.js');
    vi.mocked(queryDomainWhois).mockRejectedValue(new Error('Whois query failed: ECONNREFUSED'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'whois_query',
      arguments: { domain: 'example.com' },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain('ECONNREFUSED');
  });

  it('icp_query handles API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'icp_query',
      arguments: { query: 'baidu.com' },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain('ICP query failed');
  });
});
