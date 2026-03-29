import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as net from 'net';
import { tcpConnect, tcpBannerGrab } from '../../src/net/tcp-client.js';

let echoServer: net.Server;
let echoPort: number;

let bannerServer: net.Server;
let bannerPort: number;

beforeAll(async () => {
  // Echo server: receives data and sends it back
  echoServer = net.createServer((socket) => {
    socket.on('data', (data) => {
      socket.write(data);
    });
  });
  await new Promise<void>((resolve) => {
    echoServer.listen(0, '127.0.0.1', () => {
      echoPort = (echoServer.address() as net.AddressInfo).port;
      resolve();
    });
  });

  // Banner server: sends a banner immediately on connect
  bannerServer = net.createServer((socket) => {
    socket.write('SSH-2.0-OpenSSH_8.9\r\n');
  });
  await new Promise<void>((resolve) => {
    bannerServer.listen(0, '127.0.0.1', () => {
      bannerPort = (bannerServer.address() as net.AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => echoServer.close(() => resolve()));
  await new Promise<void>((resolve) => bannerServer.close(() => resolve()));
});

describe('tcpConnect', () => {
  it('sends data and receives echo response', async () => {
    const result = await tcpConnect({
      host: '127.0.0.1',
      port: echoPort,
      data: 'hello',
      timeout: 3,
    });

    expect(result.connected).toBe(true);
    expect(result.response.utf8).toBe('hello');
    expect(result.response.hex).toBe(Buffer.from('hello').toString('hex'));
    expect(result.timing.connect).toBeGreaterThanOrEqual(0);
    expect(result.timing.firstByte).toBeGreaterThan(0);
    expect(result.timing.total).toBeGreaterThan(0);
  });

  it('sends hex-encoded data', async () => {
    const hexData = Buffer.from('test').toString('hex');
    const result = await tcpConnect({
      host: '127.0.0.1',
      port: echoPort,
      data: hexData,
      encoding: 'hex',
      timeout: 3,
    });

    expect(result.connected).toBe(true);
    expect(result.response.utf8).toBe('test');
  });

  it('sends base64-encoded data', async () => {
    const b64Data = Buffer.from('base64test').toString('base64');
    const result = await tcpConnect({
      host: '127.0.0.1',
      port: echoPort,
      data: b64Data,
      encoding: 'base64',
      timeout: 3,
    });

    expect(result.connected).toBe(true);
    expect(result.response.utf8).toBe('base64test');
  });

  it('connects without sending data and times out gracefully', async () => {
    const result = await tcpConnect({
      host: '127.0.0.1',
      port: echoPort,
      timeout: 1,
    });

    expect(result.connected).toBe(true);
    expect(result.response.utf8).toBe('');
  });

  it('rejects on connection to closed port', async () => {
    await expect(
      tcpConnect({ host: '127.0.0.1', port: 1, timeout: 2 })
    ).rejects.toThrow('TCP connection failed');
  });
});

describe('tcpBannerGrab', () => {
  it('grabs banner from server', async () => {
    const result = await tcpBannerGrab({
      host: '127.0.0.1',
      port: bannerPort,
      timeout: 3,
    });

    expect(result.banner).toContain('SSH-2.0-OpenSSH_8.9');
    expect(result.hex).toBeTruthy();
    expect(result.timing.connect).toBeGreaterThanOrEqual(0);
    expect(result.timing.firstByte).toBeGreaterThan(0);
  });

  it('returns empty banner when server sends nothing', async () => {
    const result = await tcpBannerGrab({
      host: '127.0.0.1',
      port: echoPort,
      timeout: 1,
    });

    expect(result.banner).toBe('');
    expect(result.hex).toBe('');
  });
});
