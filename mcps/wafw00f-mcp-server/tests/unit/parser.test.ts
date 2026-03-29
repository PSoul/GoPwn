import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseWafw00fOutput } from '../../src/parsers/json-parser.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseWafw00fOutput', () => {
  it('parses waf-detected JSON', () => {
    const raw = readFileSync(join(fixturesDir, 'waf-detected.json'), 'utf-8');
    const results = parseWafw00fOutput(raw);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com');
    expect(results[0].detected).toBe(true);
    expect(results[0].firewall).toBe('Cloudflare');
    expect(results[0].manufacturer).toBe('Cloudflare Inc.');
  });

  it('parses no-waf JSON', () => {
    const raw = readFileSync(join(fixturesDir, 'no-waf.json'), 'utf-8');
    const results = parseWafw00fOutput(raw);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com');
    expect(results[0].detected).toBe(false);
    expect(results[0].firewall).toBe('');
    expect(results[0].manufacturer).toBe('');
  });

  it('returns empty array for empty input', () => {
    expect(parseWafw00fOutput('')).toEqual([]);
    expect(parseWafw00fOutput('  ')).toEqual([]);
  });

  it('throws on completely invalid input', () => {
    expect(() => parseWafw00fOutput('not json at all')).toThrow('no valid JSON found');
  });

  it('parses single JSON object', () => {
    const single = '{"url":"https://example.com","detected":true,"firewall":"Cloudflare","manufacturer":"Cloudflare Inc."}';
    const results = parseWafw00fOutput(single);
    expect(results).toHaveLength(1);
    expect(results[0].firewall).toBe('Cloudflare');
  });
});
