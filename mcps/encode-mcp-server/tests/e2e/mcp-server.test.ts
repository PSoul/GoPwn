import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEncodeDecode } from '../../src/tools/encode-decode.js';
import { registerHashCompute } from '../../src/tools/hash-compute.js';
import { registerCryptoUtil } from '../../src/tools/crypto-util.js';

async function createTestClient() {
  const server = new McpServer({ name: 'encode-mcp-server', version: '1.0.0' });
  registerEncodeDecode(server);
  registerHashCompute(server);
  registerCryptoUtil(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}

describe('encode MCP Server E2E', () => {
  it('lists all 3 tools', async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(['crypto_util', 'encode_decode', 'hash_compute']);
  });

  describe('encode_decode tool', () => {
    it('encodes base64', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'encode_decode',
        arguments: { input: 'Hello, World!', operation: 'encode', algorithm: 'base64' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toBe('SGVsbG8sIFdvcmxkIQ==');
      expect(parsed.algorithm).toBe('base64');
      expect(parsed.operation).toBe('encode');
    });

    it('decodes base64', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'encode_decode',
        arguments: { input: 'SGVsbG8sIFdvcmxkIQ==', operation: 'decode', algorithm: 'base64' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toBe('Hello, World!');
    });

    it('encodes URL with double encoding', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'encode_decode',
        arguments: {
          input: 'hello world',
          operation: 'encode',
          algorithm: 'url',
          options: { doubleEncode: true },
        },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toBe('hello%2520world');
    });
  });

  describe('hash_compute tool', () => {
    it('computes sha256 hash', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'hash_compute',
        arguments: { input: 'test', algorithm: 'sha256' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.hash).toBe(
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
      );
      expect(parsed.algorithm).toBe('sha256');
      expect(parsed.isHmac).toBe(false);
    });

    it('computes HMAC-SHA256', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'hash_compute',
        arguments: { input: 'test', algorithm: 'sha256', hmacKey: 'secret' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.isHmac).toBe(true);
      expect(parsed.hash).toBeTruthy();
    });

    it('supports base64 output', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'hash_compute',
        arguments: { input: 'test', algorithm: 'sha256', outputFormat: 'base64' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.outputFormat).toBe('base64');
    });
  });

  describe('crypto_util tool', () => {
    it('generates UUID', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'crypto_util',
        arguments: { operation: 'uuid-generate' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(parsed.operation).toBe('uuid-generate');
    });

    it('generates random string', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'crypto_util',
        arguments: { operation: 'random-string', length: 16, charset: 'hex' },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toHaveLength(16);
      expect(parsed.result).toMatch(/^[0-9a-f]+$/);
    });

    it('decodes JWT', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: '123', name: 'Test' })
      ).toString('base64url');
      const token = `${header}.${payload}.signature`;

      const client = await createTestClient();
      const result = await client.callTool({
        name: 'crypto_util',
        arguments: { operation: 'jwt-decode', token },
      });

      const content = result.content[0] as { type: string; text: string };
      const parsed = JSON.parse(content.text);
      expect(parsed.result.header.alg).toBe('HS256');
      expect(parsed.result.payload.sub).toBe('123');
    });

    it('AES encrypt/decrypt round-trip', async () => {
      const key = 'a'.repeat(64); // 32 bytes in hex
      const iv = 'b'.repeat(32); // 16 bytes in hex

      const client = await createTestClient();
      const encResult = await client.callTool({
        name: 'crypto_util',
        arguments: {
          operation: 'aes-encrypt',
          data: 'secret message',
          key,
          iv,
          mode: 'cbc',
        },
      });

      const encContent = encResult.content[0] as { type: string; text: string };
      const encParsed = JSON.parse(encContent.text);

      const decResult = await client.callTool({
        name: 'crypto_util',
        arguments: {
          operation: 'aes-decrypt',
          data: encParsed.result,
          key,
          iv: encParsed.details.iv,
          mode: 'cbc',
        },
      });

      const decContent = decResult.content[0] as { type: string; text: string };
      const decParsed = JSON.parse(decContent.text);
      expect(decParsed.result).toBe('secret message');
    });

    it('returns error for missing parameters', async () => {
      const client = await createTestClient();
      const result = await client.callTool({
        name: 'crypto_util',
        arguments: { operation: 'aes-encrypt' },
      });

      expect(result.isError).toBe(true);
      const content = result.content[0] as { type: string; text: string };
      expect(content.text).toContain('requires data and key');
    });
  });
});
