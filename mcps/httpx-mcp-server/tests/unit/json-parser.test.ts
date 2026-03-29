import { describe, it, expect } from 'vitest';
import { parseHttpxOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseHttpxOutput', () => {
  it('parses probe result JSON array', () => {
    const raw = readFileSync(join(fixturesDir, 'probe-result.json'), 'utf-8');
    const results = parseHttpxOutput(raw);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://example.com');
    expect(results[0].status_code).toBe(200);
    expect(results[0].webserver).toBe('nginx/1.24.0');
  });

  it('handles empty input', () => {
    const results = parseHttpxOutput('');
    expect(results).toEqual([]);
  });

  it('handles JSONL format (one object per line)', () => {
    const jsonl = '{"url":"https://a.com","status_code":200,"title":"A","webserver":"nginx","content_length":100}\n{"url":"https://b.com","status_code":301,"title":"","webserver":"apache","content_length":0}';
    const results = parseHttpxOutput(jsonl);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://a.com');
    expect(results[1].url).toBe('https://b.com');
  });

  it('parses single JSON object', () => {
    const single = '{"url":"https://solo.com","status_code":200,"title":"Solo","webserver":"nginx","content_length":500}';
    const results = parseHttpxOutput(single);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://solo.com');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseHttpxOutput('not json at all')).toThrow();
  });
});
