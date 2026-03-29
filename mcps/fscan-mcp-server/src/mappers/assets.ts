import type { ScanResult, Asset } from './types.js';

export function mapToAssets(results: ScanResult[]): Asset[] {
  const assetMap = new Map<string, Asset>();

  for (const r of results) {
    const addr = r.target;
    if (!assetMap.has(addr)) {
      assetMap.set(addr, {
        type: 'ip',
        address: addr,
        alive: r.type === 'HOST' && r.status === 'alive',
      });
    }

    const asset = assetMap.get(addr)!;

    if (r.type === 'HOST' && r.status === 'alive') {
      asset.alive = true;
    }

    if (r.type === 'PORT' || r.type === 'SERVICE') {
      const port = Number(r.details.port);
      if (!port) continue;
      if (!asset.ports) asset.ports = [];

      const existing = asset.ports.find((p) => p.port === port);
      if (!existing) {
        asset.ports.push({
          port,
          protocol: 'tcp',
          service: r.type === 'SERVICE' ? String(r.details.service ?? undefined) : undefined,
          fingerprint:
            r.type === 'SERVICE' && r.details.fingerprints
              ? (r.details.fingerprints as string[]).join(', ')
              : undefined,
        });
      } else if (r.type === 'SERVICE') {
        existing.service = String(r.details.service ?? existing.service);
        if (r.details.fingerprints) {
          existing.fingerprint = (r.details.fingerprints as string[]).join(', ');
        }
      }
    }
  }

  return Array.from(assetMap.values());
}
