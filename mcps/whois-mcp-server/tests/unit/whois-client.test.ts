import { describe, it, expect, vi, afterEach } from 'vitest';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';

// Mock net module
vi.mock('node:net', () => {
  return {
    Socket: vi.fn(),
  };
});

describe('WhoisClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  function createMockSocket(responseData: string, options?: { error?: Error; timeout?: boolean }) {
    const emitter = new EventEmitter();
    const mockSocket = Object.assign(emitter, {
      connect: vi.fn((_port: number, _host: string, cb: () => void) => {
        setTimeout(() => {
          if (options?.timeout) {
            emitter.emit('timeout');
            return;
          }
          if (options?.error) {
            emitter.emit('error', options.error);
            return;
          }
          cb();
          emitter.emit('data', Buffer.from(responseData));
          emitter.emit('close');
        }, 0);
        return mockSocket;
      }),
      write: vi.fn(),
      setTimeout: vi.fn(),
      destroy: vi.fn(),
    });
    (net.Socket as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockSocket);
    return mockSocket;
  }

  it('queries domain whois with correct server', async () => {
    const mockSocket = createMockSocket('Domain Name: EXAMPLE.COM\r\n');

    const { queryDomainWhois } = await import('../../src/whois/client.js');
    const result = await queryDomainWhois('example.com');

    expect(mockSocket.connect).toHaveBeenCalledWith(43, 'whois.verisign-grs.com', expect.any(Function));
    expect(mockSocket.write).toHaveBeenCalledWith('example.com\r\n');
    expect(result).toContain('EXAMPLE.COM');
  });

  it('uses custom server when provided', async () => {
    const mockSocket = createMockSocket('custom response');

    const { queryDomainWhois } = await import('../../src/whois/client.js');
    await queryDomainWhois('example.com', { server: 'custom.whois.server' });

    expect(mockSocket.connect).toHaveBeenCalledWith(43, 'custom.whois.server', expect.any(Function));
  });

  it('queries IP whois', async () => {
    const mockSocket = createMockSocket('NetRange: 8.8.8.0 - 8.8.8.255\r\n');

    const { queryIpWhois } = await import('../../src/whois/client.js');
    const result = await queryIpWhois('8.8.8.8');

    expect(mockSocket.connect).toHaveBeenCalledWith(43, 'whois.arin.net', expect.any(Function));
    expect(result).toContain('NetRange');
  });

  it('rejects on timeout', async () => {
    createMockSocket('', { timeout: true });

    const { queryDomainWhois } = await import('../../src/whois/client.js');
    await expect(queryDomainWhois('example.com', { timeout: 1000 })).rejects.toThrow('timed out');
  });

  it('rejects on connection error', async () => {
    createMockSocket('', { error: new Error('ECONNREFUSED') });

    const { queryDomainWhois } = await import('../../src/whois/client.js');
    await expect(queryDomainWhois('example.com')).rejects.toThrow('ECONNREFUSED');
  });
});
