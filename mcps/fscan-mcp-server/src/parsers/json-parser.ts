import type { ScanResult } from '../mappers/types.js';

/**
 * Parse fscan plain-text output into structured ScanResult objects.
 *
 * fscan writes plain text by default. Lines we care about:
 *   (icmp) Target 10.0.0.1   is alive
 *   10.0.0.1:80 open
 *   [*] WebTitle http://10.0.0.1:80  code:200  len:1234  title:Some Page
 *   [+] SSH 10.0.0.1:22  ...
 */
function parsePlainTextOutput(raw: string): ScanResult[] {
  const lines = raw.split('\n').filter((l) => l.trim());
  const results: ScanResult[] = [];
  const now = new Date().toISOString();

  for (const line of lines) {
    const trimmed = line.trim();

    // Host alive: "(icmp) Target 10.0.0.1   is alive"
    // Also matches: "(ping) Target 10.0.0.1   is alive"
    const aliveMatch = trimmed.match(/^\((?:icmp|ping)\)\s+Target\s+(\S+)\s+is\s+alive/i);
    if (aliveMatch) {
      results.push({
        time: now,
        type: 'HOST',
        target: aliveMatch[1],
        status: 'alive',
        details: {},
      });
      continue;
    }

    // Open port: "10.0.0.1:80 open"
    const portMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)\s+open/i);
    if (portMatch) {
      results.push({
        time: now,
        type: 'PORT',
        target: portMatch[1],
        status: 'open',
        details: { port: Number(portMatch[2]) },
      });
      continue;
    }

    // WebTitle: "[*] WebTitle http://10.0.0.1:80  code:200  len:1234  title:DVWA"
    const webMatch = trimmed.match(/^\[\*\]\s+WebTitle\s+https?:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)\S*\s+code:(\d+)/i);
    if (webMatch) {
      const titleMatch = trimmed.match(/title:(.+?)(?:\s{2,}|$)/);
      results.push({
        time: now,
        type: 'SERVICE',
        target: webMatch[1],
        status: 'identified',
        details: {
          port: Number(webMatch[2]),
          service: 'http',
          statusCode: Number(webMatch[3]),
          title: titleMatch ? titleMatch[1].trim() : undefined,
        },
      });
      continue;
    }

    // Service identification: "[+] SSH 10.0.0.1:22 ..." or "[+] ftp 10.0.0.1:21 ..."
    const serviceMatch = trimmed.match(/^\[\+\]\s+(\w+)\s+(\d+\.\d+\.\d+\.\d+):(\d+)/i);
    if (serviceMatch) {
      results.push({
        time: now,
        type: 'SERVICE',
        target: serviceMatch[2],
        status: 'identified',
        details: {
          port: Number(serviceMatch[3]),
          service: serviceMatch[1].toLowerCase(),
        },
      });
      continue;
    }
  }

  return results;
}

export function parseFscanOutput(raw: string): ScanResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as ScanResult[];
    return [parsed as ScanResult];
  } catch {
    // Not a JSON array
  }

  // Try JSONL (one JSON object per line)
  const lines = trimmed.split('\n').filter((line) => line.trim());
  const jsonResults: ScanResult[] = [];

  for (const line of lines) {
    try {
      jsonResults.push(JSON.parse(line.trim()) as ScanResult);
    } catch {
      // Not JSON
    }
  }

  if (jsonResults.length > 0) {
    return jsonResults;
  }

  // Fall back to parsing fscan plain-text output format
  return parsePlainTextOutput(trimmed);
}
