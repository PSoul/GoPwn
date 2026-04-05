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

/**
 * Generic protocol probes — sent sequentially if passive banner grab returns nothing.
 * Each probe is small and safe: it triggers a response from common services without side effects.
 */
const PROTOCOL_PROBES = [
  '\r\n',           // Generic: many services respond to empty line (FTP, SMTP, etc.)
  'PING\r\n',      // Redis, Memcached
  'QUIT\r\n',      // SMTP, FTP
  'GET / HTTP/1.0\r\n\r\n',  // HTTP fallback
];

export function tcpBannerGrab(opts: BannerGrabOptions): Promise<BannerGrabResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let connectTime = 0;
    let firstByteTime = 0;
    let settled = false;
    let probeIndex = -1; // -1 = passive phase (no probe sent yet)
    let probeTimer: ReturnType<typeof setTimeout> | null = null;

    const socket = net.createConnection({ host: opts.host, port: opts.port }, () => {
      connectTime = Date.now() - start;
      // Wait briefly for a passive banner; if nothing arrives, start sending probes
      probeTimer = setTimeout(() => sendNextProbe(), 2000);
    });

    function sendNextProbe() {
      probeIndex++;
      if (probeIndex >= PROTOCOL_PROBES.length || settled) return;
      try {
        socket.write(PROTOCOL_PROBES[probeIndex]);
      } catch { /* socket may be closed */ return; }
      // Wait 1.5s for response before trying next probe
      probeTimer = setTimeout(() => sendNextProbe(), 1500);
    }

    socket.setTimeout((opts.timeout ?? 10) * 1000);

    socket.on('data', (chunk) => {
      firstByteTime = Date.now() - start;
      if (settled) return;
      settled = true;
      if (probeTimer) clearTimeout(probeTimer);
      socket.end();
      const probeSent = probeIndex >= 0 ? PROTOCOL_PROBES[probeIndex] : undefined;
      resolve({
        banner: chunk.toString('utf-8'),
        hex: chunk.toString('hex'),
        timing: { connect: connectTime, firstByte: firstByteTime },
        ...(probeSent ? { probeSent: probeSent.replace(/\r\n/g, '\\r\\n') } : {}),
      });
    });

    socket.on('end', () => {
      if (settled) return;
      settled = true;
      if (probeTimer) clearTimeout(probeTimer);
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
      if (probeTimer) clearTimeout(probeTimer);
      resolve({
        banner: '',
        hex: '',
        timing: { connect: connectTime, firstByte: 0 },
      });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (probeTimer) clearTimeout(probeTimer);
      reject(new Error(`TCP banner grab failed: ${err.message}`));
    });
  });
}
