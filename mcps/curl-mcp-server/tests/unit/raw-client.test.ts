import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as net from 'net';
import { sendRawRequest } from '../../src/http/raw-client.js';

describe('sendRawRequest', () => {
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    server = net.createServer((socket) => {
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        // Once we receive the full request (double CRLF), respond
        if (data.includes('\r\n\r\n')) {
          const response = [
            'HTTP/1.1 200 OK',
            'Content-Type: text/plain',
            'Content-Length: 2',
            '',
            'OK',
          ].join('\r\n');
          socket.write(response);
          socket.end();
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as net.AddressInfo;
    port = addr.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('sends a raw HTTP request and receives response', async () => {
    const rawRequest = 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n';
    const result = await sendRawRequest({
      host: '127.0.0.1',
      port,
      rawRequest,
      timeout: 5,
    });

    expect(result.rawResponse).toContain('HTTP/1.1 200 OK');
    expect(result.rawResponse).toContain('OK');
    expect(result.timing.connect).toBeGreaterThanOrEqual(0);
    expect(result.timing.total).toBeGreaterThanOrEqual(0);
  });

  it('rejects on timeout', { timeout: 10000 }, async () => {
    // Create a server that accepts but never responds
    const connectedSockets: net.Socket[] = [];
    const slowServer = net.createServer((socket) => {
      connectedSockets.push(socket);
    });

    await new Promise<void>((resolve) => {
      slowServer.listen(0, '127.0.0.1', () => resolve());
    });
    const slowPort = (slowServer.address() as net.AddressInfo).port;

    try {
      await expect(
        sendRawRequest({
          host: '127.0.0.1',
          port: slowPort,
          rawRequest: 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n',
          timeout: 1,
        })
      ).rejects.toThrow('Connection timed out');
    } finally {
      // Destroy lingering sockets so server.close() doesn't hang
      for (const s of connectedSockets) s.destroy();
      await new Promise<void>((resolve) => {
        slowServer.close(() => resolve());
      });
    }
  });

  it('handles connection refused', async () => {
    await expect(
      sendRawRequest({
        host: '127.0.0.1',
        port: 1, // likely unused port
        rawRequest: 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n',
        timeout: 2,
      })
    ).rejects.toThrow();
  });
});
