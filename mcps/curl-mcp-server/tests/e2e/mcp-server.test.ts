import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHttpRequest } from '../../src/tools/request.js';
import { registerRawRequest } from '../../src/tools/raw-request.js';
import { registerHttpBatch } from '../../src/tools/batch.js';

// Mock both client modules
vi.mock('../../src/http/client.js', () => ({
  sendHttpRequest: vi.fn(),
}));

vi.mock('../../src/http/raw-client.js', () => ({
  sendRawRequest: vi.fn(),
}));

import { sendHttpRequest } from '../../src/http/client.js';
import { sendRawRequest } from '../../src/http/raw-client.js';

async function createTestClient() {
  const server = new McpServer({ name: 'curl-mcp-server', version: '1.0.0' });
  registerHttpRequest(server);
  registerRawRequest(server);
  registerHttpBatch(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('curl MCP Server E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all 3 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['http_batch', 'http_raw_request', 'http_request']);
  });

  it('http_request returns response', async () => {
    const mockSend = vi.mocked(sendHttpRequest);
    mockSend.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html>OK</html>',
      timing: { total: 42 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_request',
      arguments: { url: 'http://example.com' },
    });

    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.statusCode).toBe(200);
    expect(parsed.body).toBe('<html>OK</html>');
    expect(parsed.timing.total).toBe(42);
  });

  it('http_request with POST method', async () => {
    const mockSend = vi.mocked(sendHttpRequest);
    mockSend.mockResolvedValue({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"id":1}',
      timing: { total: 55 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_request',
      arguments: {
        url: 'http://example.com/api',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":"test"}',
      },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.statusCode).toBe(201);
  });

  it('http_request returns error on failure', async () => {
    const mockSend = vi.mocked(sendHttpRequest);
    mockSend.mockRejectedValue(new Error('Connection refused'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_request',
      arguments: { url: 'http://unreachable.local' },
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.error).toBe('Connection refused');
  });

  it('http_raw_request returns raw response', async () => {
    const mockSend = vi.mocked(sendRawRequest);
    mockSend.mockResolvedValue({
      rawResponse: 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK',
      timing: { connect: 5, total: 20 },
    });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_raw_request',
      arguments: {
        host: '127.0.0.1',
        port: 80,
        rawRequest: 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n',
      },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.rawResponse).toContain('HTTP/1.1 200 OK');
    expect(parsed.timing.connect).toBe(5);
  });

  it('http_raw_request returns error on failure', async () => {
    const mockSend = vi.mocked(sendRawRequest);
    mockSend.mockRejectedValue(new Error('Connection timed out'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_raw_request',
      arguments: {
        host: '127.0.0.1',
        port: 99999,
        rawRequest: 'GET / HTTP/1.1\r\n\r\n',
      },
    });

    expect(result.isError).toBe(true);
  });

  it('http_batch returns results for all requests', async () => {
    const mockSend = vi.mocked(sendHttpRequest);
    mockSend
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: 'ok1',
        timing: { total: 10 },
      })
      .mockResolvedValueOnce({
        statusCode: 404,
        headers: {},
        body: 'not found',
        timing: { total: 15 },
      });

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_batch',
      arguments: {
        requests: [
          { url: 'http://example.com/a' },
          { url: 'http://example.com/b' },
        ],
      },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].statusCode).toBe(200);
    expect(parsed.results[1].statusCode).toBe(404);
  });

  it('http_batch handles mixed success and failure', async () => {
    const mockSend = vi.mocked(sendHttpRequest);
    mockSend
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: 'ok',
        timing: { total: 10 },
      })
      .mockRejectedValueOnce(new Error('Timeout'));

    const client = await createTestClient();
    const result = await client.callTool({
      name: 'http_batch',
      arguments: {
        requests: [
          { url: 'http://example.com/ok' },
          { url: 'http://example.com/fail' },
        ],
        concurrency: 1,
      },
    });

    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].statusCode).toBe(200);
    expect(parsed.results[1].error).toBe('Timeout');
  });
});
