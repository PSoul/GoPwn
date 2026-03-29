import { describe, it, expect } from 'vitest';
import { mapToWebEntries } from '../../src/mappers/web-entries.js';
import { parseDirsearchOutput } from '../../src/parsers/json-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  const raw = readFileSync(join(fixturesDir, name), 'utf-8');
  return parseDirsearchOutput(raw);
}

describe('mapToWebEntries', () => {
  it('maps dirsearch results to WebEntryRecord[]', () => {
    const results = loadFixture('scan-result.json');
    const entries = mapToWebEntries(results);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      url: 'http://example.com/admin/login.php',
      statusCode: 200,
      contentLength: 4521,
    });
  });

  it('includes redirectUrl when redirect is non-empty', () => {
    const results = loadFixture('scan-result.json');
    const entries = mapToWebEntries(results);
    expect(entries[1]).toEqual({
      url: 'http://example.com/api',
      statusCode: 301,
      contentLength: 0,
      redirectUrl: 'http://example.com/api/',
    });
  });

  it('omits redirectUrl when redirect is empty', () => {
    const results = loadFixture('scan-result.json');
    const entries = mapToWebEntries(results);
    expect(entries[0].redirectUrl).toBeUndefined();
    expect(entries[2].redirectUrl).toBeUndefined();
  });

  it('returns empty array for empty input', () => {
    expect(mapToWebEntries([])).toEqual([]);
  });
});
