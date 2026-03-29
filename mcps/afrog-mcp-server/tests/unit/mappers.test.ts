import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mapToFindings } from '../../src/mappers/findings.js';
import type { AfrogResult } from '../../src/mappers/types.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('mapToFindings', () => {
  it('maps AfrogResult[] to Finding[]', () => {
    const results: AfrogResult[] = JSON.parse(
      readFileSync(join(fixturesDir, 'scan-result.json'), 'utf-8')
    );
    const findings = mapToFindings(results);

    expect(findings).toHaveLength(2);

    expect(findings[0].host).toBe('http://192.168.1.100:8080');
    expect(findings[0].port).toBe(8080);
    expect(findings[0].type).toBe('CVE-2021-44228');
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].title).toBe('Apache Log4j2 RCE');
    expect(findings[0].pocId).toBe('CVE-2021-44228');
    expect(findings[0].description).toBe('vulnerable');

    expect(findings[1].severity).toBe('medium');
    expect(findings[1].pocId).toBe('CVE-2023-1234');
  });

  it('handles empty results', () => {
    expect(mapToFindings([])).toEqual([]);
  });

  it('normalizes unknown severity to info', () => {
    const results: AfrogResult[] = [
      {
        pocinfo: { id: 'test-001', name: 'Test', severity: 'UNKNOWN', author: 'test' },
        target: 'http://example.com',
        fulloutput: 'found',
        result: 'true',
      },
    ];
    const findings = mapToFindings(results);
    expect(findings[0].severity).toBe('info');
  });

  it('extracts port from URL', () => {
    const results: AfrogResult[] = [
      {
        pocinfo: { id: 'test-001', name: 'Test', severity: 'high', author: 'test' },
        target: 'https://example.com',
        fulloutput: 'found',
        result: 'true',
      },
    ];
    const findings = mapToFindings(results);
    expect(findings[0].port).toBe(443);
  });
});
