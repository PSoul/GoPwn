import { describe, it, expect } from 'vitest';
import { parseSubfinderOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseSubfinderOutput', () => {
  it('parses enum result JSON array', () => {
    const raw = readFileSync(join(fixturesDir, 'enum-result.json'), 'utf-8');
    const results = parseSubfinderOutput(raw);
    expect(results).toHaveLength(3);
    expect(results[0].host).toBe('api.example.com');
    expect(results[0].source).toBe('crtsh');
  });

  it('handles empty input', () => {
    const results = parseSubfinderOutput('');
    expect(results).toEqual([]);
  });

  it('handles JSONL format (one object per line)', () => {
    const jsonl = '{"host":"a.example.com","input":"example.com","source":"crtsh"}\n{"host":"b.example.com","input":"example.com","source":"virustotal"}';
    const results = parseSubfinderOutput(jsonl);
    expect(results).toHaveLength(2);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSubfinderOutput('not json at all')).toThrow();
  });
});
