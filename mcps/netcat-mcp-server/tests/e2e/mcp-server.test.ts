import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTcpConnect } from '../../src/tools/tcp-connect.js';
import { registerUdpSend } from '../../src/tools/udp-send.js';
import { registerBannerGrab } from '../../src/tools/banner-grab.js';

// Mock the net clients
vi.mock('../../src/net/tcp-client.js', () => ({
  tcpConnect: vi.fn(),
  tcpBannerGrab: vi.fn(),
}));

vi.mock('../../src/net/udp-client.js', () => ({
  udpSend: vi.fn(),
}));

import { tcpConnect, tcpBannerGrab } from '../../src/net/tcp-client.js';
import { udpSend } from '../../src/net/udp-client.js';

async function createTestClient() {
  const server = new McpServer({ name: 'netcat-mcp-server', version: '1.0.0' });
  registerTcpConnect(server);
  registerUdpSend(server);
  registerBannerGrab(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('netcat MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 3 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['tcp_banner_grab', 'tcp_connect', 'udp_send']);
  });

  it('tcp_connect returns response', async () => {
    vi.mocked(tcpConnect).mockResolvedValue({
      connected: true,
      response: { utf8: 'hello', hex: '68656c6c6f' },
      timing: { connect: 5, firstByte: 10, total: 15 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'tcp_connect',
      arguments: { host: '127.0.0.1', port: 80, data: 'hello' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.connected).toBe(true);
    expect(parsed.response.utf8).toBe('hello');
    expect(parsed.timing.connect).toBe(5);
  });

  it('tcp_connect returns error on failure', async () => {
    vi.mocked(tcpConnect).mockRejectedValue(new Error('TCP connection failed: ECONNREFUSED'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'tcp_connect',
      arguments: { host: '127.0.0.1', port: 9999 },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain('TCP connection failed');
  });

  it('udp_send returns response', async () => {
    vi.mocked(udpSend).mockResolvedValue({
      response: { utf8: 'pong', hex: '706f6e67' },
      timing: { total: 12 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'udp_send',
      arguments: { host: '127.0.0.1', port: 5353, data: 'ping' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.response.utf8).toBe('pong');
    expect(parsed.timing.total).toBe(12);
  });

  it('udp_send returns null response on timeout', async () => {
    vi.mocked(udpSend).mockResolvedValue({
      response: null,
      timing: { total: 3000 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'udp_send',
      arguments: { host: '127.0.0.1', port: 5353, data: 'ping' },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.response).toBeNull();
  });

  it('tcp_banner_grab returns banner', async () => {
    vi.mocked(tcpBannerGrab).mockResolvedValue({
      banner: 'SSH-2.0-OpenSSH_8.9\r\n',
      hex: '5353482d322e302d4f70656e5353485f382e390d0a',
      timing: { connect: 3, firstByte: 8 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'tcp_banner_grab',
      arguments: { host: '192.168.1.1', port: 22 },
    });

    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.banner).toContain('SSH-2.0-OpenSSH_8.9');
    expect(parsed.timing.connect).toBe(3);
  });

  it('tcp_banner_grab returns error on failure', async () => {
    vi.mocked(tcpBannerGrab).mockRejectedValue(new Error('TCP banner grab failed: ECONNREFUSED'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'tcp_banner_grab',
      arguments: { host: '127.0.0.1', port: 9999 },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain('TCP banner grab failed');
  });
});
