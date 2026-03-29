import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mapSearchToIntelligence, mapHostToIntelligence, mapStatsToIntelligence } from '../../src/mappers/intelligence.js';
import type { FofaSearchResponse, FofaHostResponse } from '../../src/mappers/types.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

describe('mapSearchToIntelligence', () => {
  it('maps search response to intelligence record', () => {
    const response: FofaSearchResponse = loadFixture('search-result.json');
    const fields = ['host', 'ip', 'port', 'title', 'server'];
    const result = mapSearchToIntelligence('domain="example.com"', fields, response);

    expect(result.source).toBe('fofa');
    expect(result.query).toBe('domain="example.com"');
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      host: 'example.com',
      ip: '1.2.3.4',
      port: '443',
      title: 'Example Site',
      server: 'nginx',
    });
    expect(result.results[1]).toEqual({
      host: 'api.example.com',
      ip: '1.2.3.5',
      port: '8080',
      title: 'API Gateway',
      server: '',
    });
  });
});

describe('mapHostToIntelligence', () => {
  it('maps host response to intelligence record', () => {
    const response: FofaHostResponse = loadFixture('host-result.json');
    const result = mapHostToIntelligence('example.com', response);

    expect(result.source).toBe('fofa');
    expect(result.query).toBe('example.com');
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].host).toBe('example.com');
    expect(result.results[0].ip).toBe('1.2.3.4');
    expect(result.results[0].ports).toEqual([80, 443, 8080]);
  });
});

describe('mapStatsToIntelligence', () => {
  it('maps stats response to intelligence record', () => {
    const response = { error: false, distinct: { title: [{ name: 'Test', count: 5 }] } };
    const result = mapStatsToIntelligence('domain="example.com"', response);

    expect(result.source).toBe('fofa');
    expect(result.query).toBe('domain="example.com"');
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].distinct).toBeDefined();
  });
});
