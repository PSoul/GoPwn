import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHostDiscovery } from '../../src/tools/host-discovery.js';
import { registerPortScan } from '../../src/tools/port-scan.js';
import { registerServiceBruteforce } from '../../src/tools/service-bruteforce.js';
import { registerVulnScan } from '../../src/tools/vuln-scan.js';
import { registerWebScan } from '../../src/tools/web-scan.js';
import { registerFullScan } from '../../src/tools/full-scan.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the runner to return fixture data instead of calling real fscan
vi.mock('../../src/fscan/runner.js', () => ({
  runFscan: vi.fn(),
}));

import { runFscan } from '../../src/fscan/runner.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

async function createTestClient() {
  const server = new McpServer({ name: 'fscan-mcp-server', version: '1.0.0' });
  registerHostDiscovery(server);
  registerPortScan(server);
  registerServiceBruteforce(server);
  registerVulnScan(server);
  registerWebScan(server);
  registerFullScan(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('fscan MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 6 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'fscan_full_scan',
      'fscan_host_discovery',
      'fscan_port_scan',
      'fscan_service_bruteforce',
      'fscan_vuln_scan',
      'fscan_web_scan',
    ]);
  });

  it('fscan_host_discovery returns assets', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('host-discovery.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'fscan_host_discovery', arguments: { target: '192.168.1.0/24' } });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.assets).toHaveLength(2);
    expect(parsed.assets[0].alive).toBe(true);
  });

  it('fscan_port_scan returns network records', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('port-scan.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'fscan_port_scan', arguments: { target: '192.168.1.1' } });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.network).toHaveLength(2);
    expect(parsed.network[0].port).toBe(22);
  });

  it('fscan_service_bruteforce returns findings', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('service-brute.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fscan_service_bruteforce',
      arguments: { target: '192.168.1.0/24', service: 'mysql' },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0].type).toBe('weak-password');
  });

  it('fscan_vuln_scan returns vulnerability findings', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('vuln-scan.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'fscan_vuln_scan', arguments: { target: '192.168.1.10' } });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0].severity).toBe('critical');
  });

  it('fscan_web_scan returns web findings', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('web-scan.json'));

    const client = await createTestClient();
    const result = await client.callTool({ name: 'fscan_web_scan', arguments: { url: 'http://192.168.1.100' } });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.findings).toHaveLength(1);
  });

  it('fscan_web_scan errors when no target or url', async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: 'fscan_web_scan', arguments: {} });

    expect(result.isError).toBe(true);
  });

  it('fscan_full_scan returns all result types', async () => {
    const mockRun = vi.mocked(runFscan);
    mockRun.mockResolvedValue(loadFixture('full-scan.json'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'fscan_full_scan',
      arguments: { target: '192.168.1.0/24' },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.network.length).toBeGreaterThan(0);
    expect(parsed.findings.length).toBeGreaterThan(0);
    expect(parsed.assets.length).toBeGreaterThan(0);
  });
});
