import { describe, it, expect } from 'vitest';
import { mapToWebEntries } from '../../src/mappers/web-entries.js';
import type { HttpxResult } from '../../src/mappers/types.js';
import { parseHttpxOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string): HttpxResult[] {
  const raw = readFileSync(join(fixturesDir, name), 'utf-8');
  return parseHttpxOutput(raw);
}

describe('mapToWebEntries', () => {
  it('maps HttpxResult[] to WebEntryRecord[]', () => {
    const results = loadFixture('probe-result.json');
    const entries = mapToWebEntries(results);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      url: 'https://example.com',
      statusCode: 200,
      title: 'Example Domain',
      server: 'nginx/1.24.0',
      contentLength: 1256,
      technologies: ['Nginx'],
      redirectUrl: 'https://www.example.com',
    });
  });

  it('defaults technologies to empty array when tech is missing', () => {
    const results: HttpxResult[] = [
      { url: 'https://test.com', status_code: 200, title: 'Test', webserver: 'apache', content_length: 100 },
    ];
    const entries = mapToWebEntries(results);
    expect(entries[0].technologies).toEqual([]);
  });

  it('omits redirectUrl when final_url is not present', () => {
    const results: HttpxResult[] = [
      { url: 'https://direct.com', status_code: 200, title: 'Direct', webserver: 'nginx', content_length: 500 },
    ];
    const entries = mapToWebEntries(results);
    expect(entries[0].redirectUrl).toBeUndefined();
  });

  it('maps the second fixture entry correctly (301 with no title)', () => {
    const results = loadFixture('probe-result.json');
    const entries = mapToWebEntries(results);
    expect(entries[1]).toEqual({
      url: 'http://api.example.com',
      statusCode: 301,
      title: '',
      server: 'cloudflare',
      contentLength: 0,
      technologies: [],
      redirectUrl: 'https://api.example.com',
    });
  });

  it('returns empty array for empty input', () => {
    expect(mapToWebEntries([])).toEqual([]);
  });
});
