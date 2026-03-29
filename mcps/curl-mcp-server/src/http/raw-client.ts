import * as net from 'net';
import * as tls from 'tls';
import type { RawRequestOptions, RawHttpResponse } from './types.js';

export function sendRawRequest(opts: RawRequestOptions): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let connectTime = 0;
    const chunks: Buffer[] = [];

    const socket = opts.tls
      ? tls.connect(
          { host: opts.host, port: opts.port, rejectUnauthorized: false },
          () => {
            connectTime = Date.now() - start;
          }
        )
      : net.createConnection({ host: opts.host, port: opts.port }, () => {
          connectTime = Date.now() - start;
        });

    const timeoutMs = (opts.timeout ?? 10) * 1000;
    socket.setTimeout(timeoutMs);

    // Hard timeout fallback in case socket.setTimeout doesn't fire
    const hardTimeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Connection timed out'));
    }, timeoutMs + 500);

    socket.on('connect', () => {
      if (!opts.tls) {
        connectTime = Date.now() - start;
        socket.write(opts.rawRequest);
      }
    });

    if (opts.tls) {
      (socket as tls.TLSSocket).on('secureConnect', () => {
        socket.write(opts.rawRequest);
      });
    }

    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => {
      clearTimeout(hardTimeout);
      resolve({
        rawResponse: Buffer.concat(chunks).toString('utf-8'),
        timing: { connect: connectTime, total: Date.now() - start },
      });
    });
    socket.on('timeout', () => {
      clearTimeout(hardTimeout);
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
    socket.on('error', (err) => {
      clearTimeout(hardTimeout);
      reject(err);
    });
  });
}
