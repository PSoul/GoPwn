import * as net from 'node:net';
import { getWhoisServer, IP_WHOIS_SERVER } from './servers.js';

export interface WhoisQueryOptions {
  server?: string;
  timeout?: number;
}

export function queryWhoisRaw(
  query: string,
  server: string,
  timeout: number = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';

    socket.setTimeout(timeout);

    socket.connect(43, server, () => {
      socket.write(`${query}\r\n`);
    });

    socket.on('data', (chunk) => {
      data += chunk.toString('utf-8');
    });

    socket.on('close', () => {
      resolve(data);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Whois query timed out after ${timeout}ms`));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`Whois query failed: ${err.message}`));
    });
  });
}

export async function queryDomainWhois(
  domain: string,
  options: WhoisQueryOptions = {}
): Promise<string> {
  const server = options.server ?? getWhoisServer(domain);
  const timeout = options.timeout ?? 10000;
  return queryWhoisRaw(domain, server, timeout);
}

export async function queryIpWhois(
  ip: string,
  options: WhoisQueryOptions = {}
): Promise<string> {
  const server = options.server ?? IP_WHOIS_SERVER;
  const timeout = options.timeout ?? 10000;
  return queryWhoisRaw(`n + ${ip}`, server, timeout);
}
