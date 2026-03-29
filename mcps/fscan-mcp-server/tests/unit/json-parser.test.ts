import { describe, it, expect } from 'vitest';
import { parseFscanOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseFscanOutput', () => {
  it('parses host discovery JSON array', () => {
    const raw = readFileSync(join(fixturesDir, 'host-discovery.json'), 'utf-8');
    const results = parseFscanOutput(raw);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('HOST');
    expect(results[0].target).toBe('192.168.1.1');
    expect(results[0].status).toBe('alive');
  });

  it('parses port scan JSON array', () => {
    const raw = readFileSync(join(fixturesDir, 'port-scan.json'), 'utf-8');
    const results = parseFscanOutput(raw);
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('PORT');
    expect(results[2].type).toBe('SERVICE');
  });

  it('handles empty input', () => {
    const results = parseFscanOutput('');
    expect(results).toEqual([]);
  });

  it('handles JSONL format (one object per line)', () => {
    const jsonl = '{"time":"2024-01-01T00:00:00Z","type":"HOST","target":"10.0.0.1","status":"alive","details":{}}\n{"time":"2024-01-01T00:00:01Z","type":"HOST","target":"10.0.0.2","status":"alive","details":{}}';
    const results = parseFscanOutput(jsonl);
    expect(results).toHaveLength(2);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseFscanOutput('not json at all')).toThrow();
  });
});
