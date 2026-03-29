import { describe, it, expect } from 'vitest';
import { parseDirsearchOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseDirsearchOutput', () => {
  it('parses dirsearch JSON with results array', () => {
    const raw = readFileSync(join(fixturesDir, 'scan-result.json'), 'utf-8');
    const results = parseDirsearchOutput(raw);
    expect(results).toHaveLength(3);
    expect(results[0].status).toBe(200);
    expect(results[0].url).toBe('http://example.com/admin/login.php');
    expect(results[0]['content-length']).toBe(4521);
  });

  it('parses a raw array fallback', () => {
    const raw = JSON.stringify([
      { status: 200, url: 'http://example.com/test', 'content-length': 100, redirect: '' },
    ]);
    const results = parseDirsearchOutput(raw);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('http://example.com/test');
  });

  it('handles empty input', () => {
    const results = parseDirsearchOutput('');
    expect(results).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDirsearchOutput('not json at all')).toThrow('invalid JSON');
  });

  it('throws on unexpected JSON structure', () => {
    expect(() => parseDirsearchOutput('{"foo": "bar"}')).toThrow('missing "results" array');
  });
});
