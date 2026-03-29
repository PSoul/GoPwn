import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDetect } from '../../src/tools/detect.js';
import { registerList } from '../../src/tools/list.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock both runner functions
vi.mock('../../src/wafw00f/runner.js', () => ({
  runWafw00f: vi.fn(),
  runWafw00fStdout: vi.fn(),
}));

import { runWafw00f, runWafw00fStdout } from '../../src/wafw00f/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

function loadFixtureRaw(name: string) {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

async function createTestClient() {
  const server = new McpServer({ name: 'wafw00f-mcp-server', version: '1.0.0' });
  registerDetect(server);
  registerList(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('wafw00f MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 2 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['wafw00f_detect', 'wafw00f_list']);
  });

  it('wafw00f_detect returns findings for detected WAF', async () => {
    const mockRun = vi.mocked(runWafw00f);
    mockRun.mockResolvedValue(loadFixture('waf-detected.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'wafw00f_detect',
      arguments: { url: 'https://example.com' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].title).toBe('WAF Detected: Cloudflare');
    expect(parsed.findings[0].evidence.detected).toBe(true);
    expect(parsed.summary).toContain('1 WAF(s) detected');
  });

  it('wafw00f_detect passes findAll flag', async () => {
    const mockRun = vi.mocked(runWafw00f);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'wafw00f_detect',
      arguments: { url: 'https://example.com', findAll: true },
    });

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['-a']),
      })
    );
  });

  it('wafw00f_detect with no WAF detected', async () => {
    const mockRun = vi.mocked(runWafw00f);
    mockRun.mockResolvedValue(loadFixture('no-waf.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'wafw00f_detect',
      arguments: { url: 'https://example.com' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].title).toBe('No WAF Detected');
    expect(parsed.summary).toContain('0 WAF(s) detected');
  });

  it('wafw00f_list returns parsed WAFs', async () => {
    const mockStdout = vi.mocked(runWafw00fStdout);
    mockStdout.mockResolvedValue(loadFixtureRaw('waf-list.txt'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'wafw00f_list',
      arguments: {},
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.wafs.length).toBeGreaterThan(0);
    expect(parsed.wafs[0].name).toBe('Cloudflare');
    expect(parsed.wafs[0].manufacturer).toBe('Cloudflare Inc.');
    expect(parsed.summary).toContain('can detect');
  });

  it('wafw00f_detect with empty results', async () => {
    const mockRun = vi.mocked(runWafw00f);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'wafw00f_detect',
      arguments: { url: 'https://safe.example.com' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.findings).toHaveLength(0);
    expect(parsed.summary).toContain('0 WAF(s) detected');
  });
});
