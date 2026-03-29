import type { ScanResult, NetworkRecord } from './types.js';

export function mapToNetwork(results: ScanResult[]): NetworkRecord[] {
  const portMap = new Map<string, NetworkRecord>();

  for (const r of results) {
    if (r.type !== 'PORT' && r.type !== 'SERVICE') continue;

    const port = Number(r.details.port);
    if (!port) continue;

    const key = `${r.target}:${port}`;
    const existing = portMap.get(key);

    if (r.type === 'PORT' && !existing) {
      portMap.set(key, {
        host: r.target,
        port,
        protocol: 'tcp',
        service: 'unknown',
      });
    }

    if (r.type === 'SERVICE') {
      const record: NetworkRecord = {
        host: r.target,
        port,
        protocol: 'tcp',
        service: String(r.details.service ?? 'unknown'),
      };
      if (r.details.version) record.version = String(r.details.version);
      if (r.details.fingerprints) {
        const fps = r.details.fingerprints as string[];
        record.fingerprint = fps.join(', ');
      }
      portMap.set(key, record);
    }
  }

  return Array.from(portMap.values());
}
