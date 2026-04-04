import type { ScanResult } from '../mappers/types.js';

/**
 * Parse fscan plain-text output into structured ScanResult objects.
 *
 * Supports both English (fscan <2.0) and Chinese (fscan 2.0+) output formats:
 *
 * English:
 *   (icmp) Target 10.0.0.1   is alive
 *   10.0.0.1:80 open
 *   [*] WebTitle http://10.0.0.1:80  code:200  len:1234  title:Some Page
 *   [+] SSH 10.0.0.1:22  ...
 *
 * Chinese (v2.0+):
 *   [*] 端口开放 127.0.0.1:8080
 *   [*] 网站标题 http://127.0.0.1:8080  状态码:200  长度:1234  标题:Some Page
 *   [+] Redis 127.0.0.1:6379 发现未授权访问
 */
function parsePlainTextOutput(raw: string): ScanResult[] {
  const lines = raw.split('\n').filter((l) => l.trim());
  const results: ScanResult[] = [];
  const now = new Date().toISOString();

  for (const line of lines) {
    const trimmed = line.trim();

    // Host alive: "(icmp) Target 10.0.0.1   is alive"
    const aliveMatch = trimmed.match(/^\((?:icmp|ping)\)\s+Target\s+(\S+)\s+is\s+alive/i);
    if (aliveMatch) {
      results.push({ time: now, type: 'HOST', target: aliveMatch[1], status: 'alive', details: {} });
      continue;
    }

    // Open port (English): "10.0.0.1:80 open"
    const portMatchEn = trimmed.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)\s+open/i);
    if (portMatchEn) {
      results.push({ time: now, type: 'PORT', target: portMatchEn[1], status: 'open', details: { port: Number(portMatchEn[2]) } });
      continue;
    }

    // Open port (Chinese v2.0+): "[*] 端口开放 127.0.0.1:8080"
    const portMatchCn = trimmed.match(/^\[\*\]\s+端口开放\s+(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (portMatchCn) {
      results.push({ time: now, type: 'PORT', target: portMatchCn[1], status: 'open', details: { port: Number(portMatchCn[2]) } });
      continue;
    }

    // WebTitle (English): "[*] WebTitle http://10.0.0.1:80  code:200  len:1234  title:DVWA"
    const webMatchEn = trimmed.match(/^\[\*\]\s+WebTitle\s+(https?:\/\/[^\s]+)\s+code:(\d+)/i);
    if (webMatchEn) {
      const url = webMatchEn[1];
      const urlMatch = url.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const titleMatch = trimmed.match(/title:(.+?)(?:\s{2,}|$)/);
      results.push({
        time: now, type: 'SERVICE',
        target: urlMatch ? urlMatch[1] : url,
        status: 'identified',
        details: {
          port: urlMatch ? Number(urlMatch[2]) : undefined,
          service: 'http',
          statusCode: Number(webMatchEn[2]),
          title: titleMatch ? titleMatch[1].trim() : undefined,
          url,
        },
      });
      continue;
    }

    // WebTitle (Chinese v2.0+): "[*] 网站标题 http://127.0.0.1:8081  状态码:302  长度:0  标题:无标题  重定向地址: ..."
    const webMatchCn = trimmed.match(/^\[\*\]\s+网站标题\s+(https?:\/\/[^\s]+)\s+状态码:(\d+)/);
    if (webMatchCn) {
      const url = webMatchCn[1];
      const urlMatch = url.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const titleMatch = trimmed.match(/标题:(.+?)(?:\s{2,}|$)/);
      const redirectMatch = trimmed.match(/重定向地址:\s*(\S+)/);
      results.push({
        time: now, type: 'SERVICE',
        target: urlMatch ? urlMatch[1] : url,
        status: 'identified',
        details: {
          port: urlMatch ? Number(urlMatch[2]) : undefined,
          service: 'http',
          statusCode: Number(webMatchCn[2]),
          title: titleMatch ? titleMatch[1].trim() : undefined,
          url,
          redirect: redirectMatch ? redirectMatch[1] : undefined,
        },
      });
      continue;
    }

    // Service/vuln (English): "[+] SSH 10.0.0.1:22 ..." or "[+] Redis 10.0.0.1:6379 ..."
    const serviceMatchEn = trimmed.match(/^\[\+\]\s+(\w+)\s+(\d+\.\d+\.\d+\.\d+):(\d+)(.*)/i);
    if (serviceMatchEn) {
      const detail = serviceMatchEn[4].trim();
      const isVuln = /未授权|unauthorized|弱密码|weak|漏洞|vuln/i.test(detail);
      results.push({
        time: now,
        type: isVuln ? 'VULN' : 'SERVICE',
        target: serviceMatchEn[2],
        status: isVuln ? 'vulnerable' : 'identified',
        details: {
          port: Number(serviceMatchEn[3]),
          service: serviceMatchEn[1].toLowerCase(),
          info: detail || undefined,
        },
      });
      continue;
    }

    // Vuln (Chinese v2.0+): "[+] 检测到漏洞 http://... poc-yaml-xxx ..."
    const vulnMatchCn = trimmed.match(/^\[\+\]\s+检测到漏洞\s+(\S+)\s+(\S+)/);
    if (vulnMatchCn) {
      const urlMatch = vulnMatchCn[1].match(/https?:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      results.push({
        time: now, type: 'VULN',
        target: urlMatch ? urlMatch[1] : vulnMatchCn[1],
        status: 'vulnerable',
        details: {
          port: urlMatch ? Number(urlMatch[2]) : undefined,
          service: 'http',
          poc: vulnMatchCn[2],
          url: vulnMatchCn[1],
        },
      });
      continue;
    }

    // Structured log format (fscan v2.0+ output file):
    // [2026-04-04 23:02:09] [PORT] 目标:127.0.0.1 状态:open 详情:port=8080
    // [2026-04-04 23:02:09] [SERVICE] 目标:127.0.0.1 状态:identified 详情:service=http, ...
    // [2026-04-04 23:02:12] [VULN] 目标:127.0.0.1 状态:vulnerable 详情:port=6379, ...
    const structMatch = trimmed.match(/^\[[\d\-\s:]+\]\s+\[(PORT|SERVICE|VULN)\]\s+目标:(\S+)\s+状态:(\S+)\s+详情:(.*)/);
    if (structMatch) {
      const [, type, target, status, detailStr] = structMatch;
      const details = parseDetailString(detailStr);
      // Extract host from URL targets
      const hostMatch = target.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+)/);
      results.push({
        time: now,
        type: type as 'PORT' | 'SERVICE' | 'VULN',
        target: hostMatch ? hostMatch[1] : target,
        status,
        details,
      });
      continue;
    }
  }

  return results;
}

/** Parse fscan structured detail string: "port=8080, service=http, title=..." */
function parseDetailString(detailStr: string): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  // Simple key=value parsing (handles nested map[] and array[] by treating them as strings)
  const parts = detailStr.split(/,\s*(?=[a-zA-Z_]+=)/);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    let value: unknown = part.slice(eqIdx + 1).trim();
    // Convert port to number
    if (key === 'port' || key === 'status_code' || key === 'length') {
      const num = Number(value);
      if (!isNaN(num)) value = num;
    }
    details[key] = value;
  }
  return details;
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
