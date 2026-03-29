import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScan } from '../../src/tools/scan.js';
import { registerRecursive } from '../../src/tools/recursive.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the runner to return fixture data instead of calling real dirsearch
vi.mock('../../src/dirsearch/runner.js', () => ({
  runDirsearch: vi.fn(),
}));

import { runDirsearch } from '../../src/dirsearch/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixtureResults(name: string) {
  const raw = JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
  return raw.results;
}

async function createTestClient() {
  const server = new McpServer({ name: 'dirsearch-mcp-server', version: '1.0.0' });
  registerScan(server);
  registerRecursive(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('dirsearch MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 2 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'dirsearch_recursive',
      'dirsearch_scan',
    ]);
  });

  it('dirsearch_scan returns web entries', async () => {
    const mockRun = vi.mocked(runDirsearch);
    mockRun.mockResolvedValue(loadFixtureResults('scan-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'dirsearch_scan', arguments: { url: 'http://example.com' } });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0].url).toBe('http://example.com/admin/login.php');
    expect(parsed.entries[0].statusCode).toBe(200);
    expect(parsed.entries[1].redirectUrl).toBe('http://example.com/api/');
  });

  it('dirsearch_recursive returns web entries', async () => {
    const mockRun = vi.mocked(runDirsearch);
    mockRun.mockResolvedValue(loadFixtureResults('scan-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'dirsearch_recursive',
      arguments: { url: 'http://example.com', depth: 3 },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.summary).toContain('recursive');
  });

  it('dirsearch_scan passes correct args to runner', async () => {
    const mockRun = vi.mocked(runDirsearch);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'dirsearch_scan',
      arguments: {
        url: 'http://example.com',
        wordlist: '/tmp/words.txt',
        extensions: 'php,asp',
        threads: 50,
        excludeStatus: '404,403',
        timeout: 20,
      },
    });

    expect(mockRun).toHaveBeenCalledWith({
      args: [
        '-u', 'http://example.com',
        '-w', '/tmp/words.txt',
        '-e', 'php,asp',
        '-t', '50',
        '--exclude-status', '404,403',
        '--timeout', '20',
      ],
      timeoutMs: 1_200_000,
    });
  });

  it('dirsearch_recursive passes correct args to runner', async () => {
    const mockRun = vi.mocked(runDirsearch);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'dirsearch_recursive',
      arguments: {
        url: 'http://example.com',
        depth: 5,
        wordlist: '/tmp/words.txt',
        extensions: 'php',
        timeout: 15,
      },
    });

    expect(mockRun).toHaveBeenCalledWith({
      args: [
        '-u', 'http://example.com',
        '-r', '--max-recursion-depth', '5',
        '-w', '/tmp/words.txt',
        '-e', 'php',
        '--timeout', '15',
      ],
      timeoutMs: 900_000,
    });
  });
});
