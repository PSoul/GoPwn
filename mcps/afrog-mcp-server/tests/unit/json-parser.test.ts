import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseAfrogOutput } from '../../src/parsers/json-parser.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseAfrogOutput', () => {
  it('parses JSON array format', () => {
    const raw = readFileSync(join(fixturesDir, 'scan-result.json'), 'utf-8');
    const results = parseAfrogOutput(raw);
    expect(results).toHaveLength(2);
    expect(results[0].pocinfo.id).toBe('CVE-2021-44228');
    expect(results[1].pocinfo.severity).toBe('medium');
  });

  it('parses JSONL format', () => {
    const jsonl = [
      '{"pocinfo":{"id":"CVE-2021-44228","name":"Log4j2 RCE","severity":"critical","author":"test"},"target":"http://example.com","fulloutput":"vuln","result":"true"}',
      '{"pocinfo":{"id":"CVE-2023-0001","name":"Test Vuln","severity":"high","author":"test"},"target":"http://example.com","fulloutput":"found","result":"true"}',
    ].join('\n');

    const results = parseAfrogOutput(jsonl);
    expect(results).toHaveLength(2);
    expect(results[0].pocinfo.id).toBe('CVE-2021-44228');
    expect(results[1].pocinfo.severity).toBe('high');
  });

  it('returns empty array for empty input', () => {
    expect(parseAfrogOutput('')).toEqual([]);
    expect(parseAfrogOutput('  ')).toEqual([]);
  });

  it('throws on completely invalid input', () => {
    expect(() => parseAfrogOutput('not json at all')).toThrow('no valid JSON found');
  });

  it('parses single JSON object', () => {
    const single = '{"pocinfo":{"id":"CVE-2021-44228","name":"Log4j2","severity":"critical","author":"test"},"target":"http://example.com","fulloutput":"vuln","result":"true"}';
    const results = parseAfrogOutput(single);
    expect(results).toHaveLength(1);
    expect(results[0].pocinfo.id).toBe('CVE-2021-44228');
  });
});
