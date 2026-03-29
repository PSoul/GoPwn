import { describe, it, expect } from 'vitest';
import { mapToNetwork } from '../../src/mappers/network.js';
import { mapToFindings } from '../../src/mappers/findings.js';
import { mapToAssets } from '../../src/mappers/assets.js';
import type { ScanResult } from '../../src/mappers/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFscanOutput } from '../../src/parsers/json-parser.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string): ScanResult[] {
  const raw = readFileSync(join(fixturesDir, name), 'utf-8');
  return parseFscanOutput(raw);
}

describe('mapToNetwork', () => {
  it('maps PORT and SERVICE results to NetworkRecord[]', () => {
    const results = loadFixture('port-scan.json');
    const records = mapToNetwork(results);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      host: '192.168.1.1',
      port: 22,
      protocol: 'tcp',
      service: 'unknown',
    });
    expect(records[1]).toMatchObject({
      host: '192.168.1.1',
      port: 80,
      service: 'http',
    });
  });

  it('returns empty array when no PORT/SERVICE results', () => {
    const results = loadFixture('host-discovery.json');
    expect(mapToNetwork(results)).toEqual([]);
  });
});

describe('mapToFindings', () => {
  it('maps VULN results to Finding[]', () => {
    const results = loadFixture('vuln-scan.json');
    const findings = mapToFindings(results);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      host: '192.168.1.10',
      port: 445,
      type: 'MS17-010',
      severity: 'critical',
    });
  });

  it('maps brute force results to findings', () => {
    const results = loadFixture('service-brute.json');
    const findings = mapToFindings(results);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      host: '192.168.1.20',
      type: 'weak-password',
      title: expect.stringContaining('mysql'),
    });
    expect(findings[1]).toMatchObject({
      type: 'unauthorized',
    });
  });
});

describe('mapToAssets', () => {
  it('maps HOST results to Asset[]', () => {
    const results = loadFixture('host-discovery.json');
    const assets = mapToAssets(results);
    expect(assets).toHaveLength(2);
    expect(assets[0]).toEqual({
      type: 'ip',
      address: '192.168.1.1',
      alive: true,
    });
  });

  it('aggregates ports into assets from mixed results', () => {
    const results = loadFixture('port-scan.json');
    const assets = mapToAssets(results);
    expect(assets).toHaveLength(1);
    expect(assets[0].address).toBe('192.168.1.1');
    expect(assets[0].ports).toHaveLength(2);
  });
});
