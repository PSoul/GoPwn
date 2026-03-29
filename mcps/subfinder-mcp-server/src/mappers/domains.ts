import type { SubfinderResult, DomainRecord } from './types.js';

export function mapToDomains(results: SubfinderResult[]): DomainRecord[] {
  const seen = new Map<string, DomainRecord>();

  for (const r of results) {
    if (!seen.has(r.host)) {
      seen.set(r.host, {
        domain: r.input,
        host: r.host,
        source: r.source,
      });
    }
  }

  return Array.from(seen.values());
}
