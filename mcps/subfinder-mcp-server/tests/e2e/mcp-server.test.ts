import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEnum } from '../../src/tools/enum.js';
import { registerVerify } from '../../src/tools/verify.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the runner to return fixture data instead of calling real subfinder
vi.mock('../../src/subfinder/runner.js', () => ({
  runSubfinder: vi.fn(),
}));

import { runSubfinder } from '../../src/subfinder/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

async function createTestClient() {
  const server = new McpServer({ name: 'subfinder-mcp-server', version: '1.0.0' });
  registerEnum(server);
  registerVerify(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('subfinder MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 2 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'subfinder_enum',
      'subfinder_verify',
    ]);
  });

  it('subfinder_enum returns domains', async () => {
    const mockRun = vi.mocked(runSubfinder);
    mockRun.mockResolvedValue(loadFixture('enum-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'subfinder_enum', arguments: { target: 'example.com' } });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.domains).toHaveLength(3);
    expect(parsed.domains[0].host).toBe('api.example.com');
    expect(parsed.domains[0].source).toBe('crtsh');
  });

  it('subfinder_enum passes sources and recursive args', async () => {
    const mockRun = vi.mocked(runSubfinder);
    mockRun.mockResolvedValue(loadFixture('enum-result.json'));

    const client = await createTestClient();
    await client.callTool({
      name: 'subfinder_enum',
      arguments: { target: 'example.com', sources: ['crtsh', 'virustotal'], recursive: true, timeout: 45 },
    });

    expect(mockRun).toHaveBeenCalledWith({
      args: ['-d', 'example.com', '-s', 'crtsh,virustotal', '-recursive', '-timeout', '45'],
      timeoutMs: 90_000,
    });
  });

  it('subfinder_verify returns verified domains', async () => {
    const mockRun = vi.mocked(runSubfinder);
    mockRun.mockResolvedValue(loadFixture('enum-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'subfinder_verify', arguments: { target: 'example.com' } });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.domains).toHaveLength(3);
    expect(parsed.summary).toContain('Verified');
  });

  it('subfinder_verify passes resolvers arg', async () => {
    const mockRun = vi.mocked(runSubfinder);
    mockRun.mockResolvedValue(loadFixture('enum-result.json'));

    const client = await createTestClient();
    await client.callTool({
      name: 'subfinder_verify',
      arguments: { target: 'example.com', resolvers: ['8.8.8.8', '1.1.1.1'], timeout: 90 },
    });

    expect(mockRun).toHaveBeenCalledWith({
      args: ['-d', 'example.com', '-nW', '-r', '8.8.8.8,1.1.1.1', '-timeout', '90'],
      timeoutMs: 180_000,
    });
  });
});
