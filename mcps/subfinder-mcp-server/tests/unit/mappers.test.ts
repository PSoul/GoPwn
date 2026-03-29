import { describe, it, expect } from 'vitest';
import { mapToDomains } from '../../src/mappers/domains.js';
import type { SubfinderResult } from '../../src/mappers/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSubfinderOutput } from '../../src/parsers/json-parser.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string): SubfinderResult[] {
  const raw = readFileSync(join(fixturesDir, name), 'utf-8');
  return parseSubfinderOutput(raw);
}

describe('mapToDomains', () => {
  it('maps SubfinderResult[] to DomainRecord[]', () => {
    const results = loadFixture('enum-result.json');
    const domains = mapToDomains(results);
    expect(domains).toHaveLength(3);
    expect(domains[0]).toEqual({
      domain: 'example.com',
      host: 'api.example.com',
      source: 'crtsh',
    });
    expect(domains[1]).toEqual({
      domain: 'example.com',
      host: 'mail.example.com',
      source: 'virustotal',
    });
    expect(domains[2]).toEqual({
      domain: 'example.com',
      host: 'dev.example.com',
      source: 'hackertarget',
    });
  });

  it('deduplicates by host', () => {
    const results: SubfinderResult[] = [
      { host: 'api.example.com', input: 'example.com', source: 'crtsh' },
      { host: 'api.example.com', input: 'example.com', source: 'virustotal' },
      { host: 'mail.example.com', input: 'example.com', source: 'crtsh' },
    ];
    const domains = mapToDomains(results);
    expect(domains).toHaveLength(2);
    // First occurrence wins
    expect(domains[0].source).toBe('crtsh');
  });

  it('returns empty array for empty input', () => {
    expect(mapToDomains([])).toEqual([]);
  });
});
