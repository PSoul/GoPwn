import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScan } from '../../src/tools/scan.js';
import { registerListPocs } from '../../src/tools/list-pocs.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock both runner functions
vi.mock('../../src/afrog/runner.js', () => ({
  runAfrog: vi.fn(),
  runAfrogStdout: vi.fn(),
}));

import { runAfrog, runAfrogStdout } from '../../src/afrog/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

async function createTestClient() {
  const server = new McpServer({ name: 'afrog-mcp-server', version: '1.0.0' });
  registerScan(server);
  registerListPocs(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('afrog MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 2 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['afrog_list_pocs', 'afrog_scan']);
  });

  it('afrog_scan returns findings', async () => {
    const mockRun = vi.mocked(runAfrog);
    mockRun.mockResolvedValue(loadFixture('scan-result.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'afrog_scan',
      arguments: { target: 'http://192.168.1.100:8080' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0].severity).toBe('critical');
    expect(parsed.findings[0].pocId).toBe('CVE-2021-44228');
    expect(parsed.findings[1].severity).toBe('medium');
  });

  it('afrog_scan passes severity filter', async () => {
    const mockRun = vi.mocked(runAfrog);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    await client.callTool({
      name: 'afrog_scan',
      arguments: { target: 'http://example.com', severity: 'critical' },
    });

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['-severity', 'critical']),
      })
    );
  });

  it('afrog_list_pocs returns parsed POCs', async () => {
    const mockStdout = vi.mocked(runAfrogStdout);
    mockStdout.mockResolvedValue(
      '[critical] CVE-2021-44228 Apache Log4j2 RCE\n[medium] CVE-2023-1234 Spring Boot Actuator\n'
    );

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'afrog_list_pocs',
      arguments: {},
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.pocs).toHaveLength(2);
    expect(parsed.pocs[0].id).toBe('CVE-2021-44228');
    expect(parsed.pocs[0].severity).toBe('critical');
    expect(parsed.pocs[1].id).toBe('CVE-2023-1234');
  });

  it('afrog_scan with empty results', async () => {
    const mockRun = vi.mocked(runAfrog);
    mockRun.mockResolvedValue([]);

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'afrog_scan',
      arguments: { target: 'http://safe.example.com' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.findings).toHaveLength(0);
    expect(parsed.summary).toContain('0 vulnerabilities');
  });
});
