import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProbe } from '../../src/tools/probe.js';
import { registerTechDetect } from '../../src/tools/tech-detect.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the runner to return fixture data instead of calling real httpx
vi.mock('../../src/httpx/runner.js', () => ({
  runHttpx: vi.fn(),
}));

import { runHttpx } from '../../src/httpx/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

async function createTestClient() {
  const server = new McpServer({ name: 'httpx-mcp-server', version: '1.0.0' });
  registerProbe(server);
  registerTechDetect(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('httpx MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 2 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'httpx_probe',
      'httpx_tech_detect',
    ]);
  });

  it('httpx_probe returns web entries', async () => {
    const mockRun = vi.mocked(runHttpx);
    mockRun.mockResolvedValue(loadFixture('probe-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'httpx_probe',
      arguments: { targets: ['https://example.com', 'http://api.example.com'] },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.webEntries).toHaveLength(2);
    expect(parsed.webEntries[0].url).toBe('https://example.com');
    expect(parsed.webEntries[0].statusCode).toBe(200);
    expect(parsed.webEntries[0].technologies).toEqual(['Nginx']);
  });

  it('httpx_probe passes correct args to runner', async () => {
    const mockRun = vi.mocked(runHttpx);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'httpx_probe',
      arguments: { targets: ['https://example.com'], ports: '80,443', threads: 25, timeout: 10 },
    });

    expect(mockRun).toHaveBeenCalledOnce();
    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.args).toContain('-p');
    expect(callArgs.args).toContain('80,443');
    expect(callArgs.args).toContain('-t');
    expect(callArgs.args).toContain('25');
    expect(callArgs.args).toContain('-timeout');
    expect(callArgs.args).toContain('10');
    expect(callArgs.stdinData).toBe('https://example.com\n');
  });

  it('httpx_tech_detect returns web entries with technologies', async () => {
    const mockRun = vi.mocked(runHttpx);
    mockRun.mockResolvedValue(loadFixture('probe-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'httpx_tech_detect',
      arguments: { targets: ['https://example.com'] },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.webEntries).toHaveLength(2);
    expect(parsed.webEntries[0].technologies).toEqual(['Nginx']);
  });

  it('httpx_tech_detect passes -tech-detect flag', async () => {
    const mockRun = vi.mocked(runHttpx);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'httpx_tech_detect',
      arguments: { targets: ['https://example.com'] },
    });

    expect(mockRun).toHaveBeenCalledOnce();
    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.args).toContain('-tech-detect');
    expect(callArgs.stdinData).toBe('https://example.com\n');
  });
});
