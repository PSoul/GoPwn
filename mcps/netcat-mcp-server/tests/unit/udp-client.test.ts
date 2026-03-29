import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dgram from 'dgram';
import { udpSend } from '../../src/net/udp-client.js';

let echoServer: dgram.Socket;
let echoPort: number;

beforeAll(async () => {
  echoServer = dgram.createSocket('udp4');
  echoServer.on('message', (msg, rinfo) => {
    echoServer.send(msg, rinfo.port, rinfo.address);
  });
  await new Promise<void>((resolve) => {
    echoServer.bind(0, '127.0.0.1', () => {
      echoPort = (echoServer.address() as dgram.RemoteInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    echoServer.close(() => resolve());
  });
});

describe('udpSend', () => {
  it('sends data and receives echo response', async () => {
    const result = await udpSend({
      host: '127.0.0.1',
      port: echoPort,
      data: 'hello-udp',
      timeout: 3,
    });

    expect(result.response).not.toBeNull();
    expect(result.response!.utf8).toBe('hello-udp');
    expect(result.response!.hex).toBe(Buffer.from('hello-udp').toString('hex'));
    expect(result.timing.total).toBeGreaterThan(0);
  });

  it('sends hex-encoded data', async () => {
    const hexData = Buffer.from('udp-hex').toString('hex');
    const result = await udpSend({
      host: '127.0.0.1',
      port: echoPort,
      data: hexData,
      encoding: 'hex',
      timeout: 3,
    });

    expect(result.response).not.toBeNull();
    expect(result.response!.utf8).toBe('udp-hex');
  });

  it('sends base64-encoded data', async () => {
    const b64Data = Buffer.from('udp-b64').toString('base64');
    const result = await udpSend({
      host: '127.0.0.1',
      port: echoPort,
      data: b64Data,
      encoding: 'base64',
      timeout: 3,
    });

    expect(result.response).not.toBeNull();
    expect(result.response!.utf8).toBe('udp-b64');
  });

  it('returns null response on timeout (no server response)', async () => {
    // Send to a port where nothing is listening for a reply
    const result = await udpSend({
      host: '127.0.0.1',
      port: 19999,
      data: 'no-reply',
      timeout: 1,
    });

    expect(result.response).toBeNull();
    expect(result.timing.total).toBeGreaterThanOrEqual(900);
  });
});
