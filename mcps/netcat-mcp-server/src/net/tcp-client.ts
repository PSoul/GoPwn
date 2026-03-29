import * as net from 'net';
import type { TcpConnectOptions, TcpResponse, BannerGrabOptions, BannerGrabResponse } from './types.js';

export function tcpConnect(opts: TcpConnectOptions): Promise<TcpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let connectTime = 0;
    let firstByteTime = 0;
    const chunks: Buffer[] = [];
    let gotData = false;
    let settled = false;

    const socket = net.createConnection({ host: opts.host, port: opts.port }, () => {
      connectTime = Date.now() - start;
      if (opts.data) {
        const buf = opts.encoding === 'hex' ? Buffer.from(opts.data, 'hex')
          : opts.encoding === 'base64' ? Buffer.from(opts.data, 'base64')
          : Buffer.from(opts.data, 'utf-8');
        socket.write(buf);
      }
    });

    socket.setTimeout((opts.timeout ?? 5) * 1000);

    socket.on('data', (chunk) => {
      if (!gotData) { firstByteTime = Date.now() - start; gotData = true; }
      chunks.push(chunk);
      if (!opts.readUntilClose) {
        socket.end();
      }
    });

    socket.on('end', () => {
      if (settled) return;
      settled = true;
      const buf = Buffer.concat(chunks);
      resolve({
        connected: true,
        response: { utf8: buf.toString('utf-8'), hex: buf.toString('hex') },
        timing: { connect: connectTime, firstByte: firstByteTime, total: Date.now() - start },
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (settled) return;
      settled = true;
      if (chunks.length > 0) {
        const buf = Buffer.concat(chunks);
        resolve({
          connected: true,
          response: { utf8: buf.toString('utf-8'), hex: buf.toString('hex') },
          timing: { connect: connectTime, firstByte: firstByteTime, total: Date.now() - start },
        });
      } else {
        resolve({
          connected: true,
          response: { utf8: '', hex: '' },
          timing: { connect: connectTime, firstByte: 0, total: Date.now() - start },
        });
      }
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new Error(`TCP connection failed: ${err.message}`));
    });
  });
}

export function tcpBannerGrab(opts: BannerGrabOptions): Promise<BannerGrabResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let connectTime = 0;
    let firstByteTime = 0;
    let settled = false;

    const socket = net.createConnection({ host: opts.host, port: opts.port }, () => {
      connectTime = Date.now() - start;
      // Do not send any data — just wait for the server to send a banner
    });

    socket.setTimeout((opts.timeout ?? 5) * 1000);

    socket.on('data', (chunk) => {
      firstByteTime = Date.now() - start;
      if (settled) return;
      settled = true;
      socket.end();
      resolve({
        banner: chunk.toString('utf-8'),
        hex: chunk.toString('hex'),
        timing: { connect: connectTime, firstByte: firstByteTime },
      });
    });

    socket.on('end', () => {
      if (settled) return;
      settled = true;
      resolve({
        banner: '',
        hex: '',
        timing: { connect: connectTime, firstByte: 0 },
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (settled) return;
      settled = true;
      resolve({
        banner: '',
        hex: '',
        timing: { connect: connectTime, firstByte: 0 },
      });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new Error(`TCP banner grab failed: ${err.message}`));
    });
  });
}
