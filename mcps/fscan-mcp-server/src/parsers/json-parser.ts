import type { ScanResult } from '../mappers/types.js';

/**
 * Parse fscan plain-text output into structured ScanResult objects.
 *
 * Supports TWO output formats:
 *
 * 1. Console output (English, fscan <= 1.x):
 *    (icmp) Target 10.0.0.1   is alive
 *    10.0.0.1:80 open
 *    [*] WebTitle http://10.0.0.1:80  code:200  len:1234  title:Some Page
 *    [+] SSH 10.0.0.1:22  ...
 *
 * 2. File output (Chinese, fscan 2.0.1+):
 *    [2026-04-03 00:12:39] [PORT] 目标:127.0.0.1 状态:open 详情:port=8888
 *    [2026-04-03 00:12:39] [SERVICE] 目标:127.0.0.1 状态:identified 详情:port=3000, service=http, title=...
 *    [2026-04-03 00:12:39] [HOST] 目标:127.0.0.1 状态:alive 详情:...
 */
function parsePlainTextOutput(raw: string): ScanResult[] {
  const lines = raw.split('\n').filter((l) => l.trim());
  const results: ScanResult[] = [];
  const now = new Date().toISOString();

  for (const line of lines) {
    const trimmed = line.trim();

    // === fscan 2.0.1+ file output format (Chinese) ===

    // [timestamp] [PORT] 目标:IP 状态:open 详情:port=N
    const cnPortMatch = trimmed.match(/\[PORT\]\s+目标:(\S+)\s+状态:(\S+)\s+详情:.*?port=(\d+)/);
    if (cnPortMatch) {
      results.push({
        time: now,
        type: 'PORT',
        target: cnPortMatch[1],
        status: cnPortMatch[2],
        details: { port: Number(cnPortMatch[3]) },
      });
      continue;
    }

    // [timestamp] [HOST] 目标:IP 状态:alive
    const cnHostMatch = trimmed.match(/\[HOST\]\s+目标:(\S+)\s+状态:(\S+)/);
    if (cnHostMatch) {
      results.push({
        time: now,
        type: 'HOST',
        target: cnHostMatch[1],
        status: cnHostMatch[2],
        details: {},
      });
      continue;
    }

    // [timestamp] [SERVICE] 目标:IP 状态:identified 详情:...port=N...service=xxx...
    const cnServiceMatch = trimmed.match(/\[SERVICE\]\s+目标:(\S+)\s+状态:(\S+)\s+详情:(.*)/);
    if (cnServiceMatch) {
      const detailStr = cnServiceMatch[3];
      const portVal = detailStr.match(/port=(\d+)/);
      const serviceVal = detailStr.match(/service=(\w+)/);
      const titleVal = detailStr.match(/title=([^,]+?)(?:,\s|$)/);
      const statusCodeVal = detailStr.match(/status_code=(\d+)/);
      const details: Record<string, unknown> = {};
      if (portVal) details.port = Number(portVal[1]);
      if (serviceVal) details.service = serviceVal[1].toLowerCase();
      if (titleVal) details.title = titleVal[1].trim();
      if (statusCodeVal) details.statusCode = Number(statusCodeVal[1]);
      results.push({
        time: now,
        type: 'SERVICE',
        target: cnServiceMatch[1],
        status: cnServiceMatch[2],
        details,
      });
      continue;
    }

    // [timestamp] [VULN] 目标:IP 状态:... 详情:...
    const cnVulnMatch = trimmed.match(/\[VULN\]\s+目标:(\S+)\s+状态:(\S+)\s+详情:(.*)/);
    if (cnVulnMatch) {
      results.push({
        time: now,
        type: 'VULN',
        target: cnVulnMatch[1],
        status: cnVulnMatch[2],
        details: { raw: cnVulnMatch[3] },
      });
      continue;
    }

    // === Classic console output format (English) ===

    // Host alive: "(icmp) Target 10.0.0.1   is alive"
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

    // Open port: "10.0.0.1:80 open" or "[*] 端口开放 10.0.0.1:80"
    const portMatch = trimmed.match(/^(?:\[\*\]\s+端口开放\s+)?(\d+\.\d+\.\d+\.\d+):(\d+)\s*(?:open)?/i);
    if (portMatch && (trimmed.includes('open') || trimmed.includes('端口开放'))) {
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
    // Also: "[*] 网站标题 http://10.0.0.1:80  状态码:200  长度:1234  标题:..."
    const webMatch = trimmed.match(/^\[\*\]\s+(?:WebTitle|网站标题)\s+https?:\/\/([^/:]+):(\d+)\S*\s+(?:code|状态码):(\d+)/i);
    if (webMatch) {
      const titleMatch = trimmed.match(/(?:title|标题):(.+?)(?:\s{2,}|$)/);
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
