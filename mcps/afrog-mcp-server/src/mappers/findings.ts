import type { AfrogResult, Finding } from './types.js';

const VALID_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

function normalizeSeverity(severity: string): Finding['severity'] {
  const lower = severity.toLowerCase();
  if (VALID_SEVERITIES.has(lower)) {
    return lower as Finding['severity'];
  }
  return 'info';
}

function extractPort(target: string): number | undefined {
  try {
    const url = new URL(target);
    if (url.port) return Number(url.port);
    if (url.protocol === 'https:') return 443;
    if (url.protocol === 'http:') return 80;
  } catch {
    // Try host:port pattern
    const match = target.match(/:(\d+)$/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

export function mapToFindings(results: AfrogResult[]): Finding[] {
  return results.map((r) => ({
    host: r.target,
    port: extractPort(r.target),
    type: r.pocinfo.id,
    severity: normalizeSeverity(r.pocinfo.severity),
    title: r.pocinfo.name,
    description: r.fulloutput || `Vulnerability ${r.pocinfo.id} detected on ${r.target}`,
    pocId: r.pocinfo.id,
    evidence: {
      result: r.result,
      fulloutput: r.fulloutput,
      author: r.pocinfo.author,
    },
  }));
}
