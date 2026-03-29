import * as dgram from 'dgram';
import type { UdpSendOptions, UdpResponse } from './types.js';

export function udpSend(opts: UdpSendOptions): Promise<UdpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = dgram.createSocket('udp4');

    const buf = opts.encoding === 'hex' ? Buffer.from(opts.data, 'hex')
      : opts.encoding === 'base64' ? Buffer.from(opts.data, 'base64')
      : Buffer.from(opts.data, 'utf-8');

    const timer = setTimeout(() => {
      socket.close();
      resolve({ response: null, timing: { total: Date.now() - start } });
    }, (opts.timeout ?? 3) * 1000);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      socket.close();
      resolve({
        response: { utf8: msg.toString('utf-8'), hex: msg.toString('hex') },
        timing: { total: Date.now() - start },
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`UDP error: ${err.message}`));
    });

    socket.send(buf, opts.port, opts.host);
  });
}
