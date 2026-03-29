import type { FofaSearchResponse, FofaHostResponse, IntelligenceRecord } from './types.js';

export function mapSearchToIntelligence(
  query: string,
  fields: string[],
  response: FofaSearchResponse
): IntelligenceRecord {
  return {
    source: 'fofa',
    query,
    total: response.size,
    results: response.results.map((row) => {
      const record: Record<string, unknown> = {};
      fields.forEach((f, i) => {
        record[f] = row[i];
      });
      return record;
    }),
  };
}

export function mapHostToIntelligence(
  host: string,
  response: FofaHostResponse
): IntelligenceRecord {
  return {
    source: 'fofa',
    query: host,
    total: 1,
    results: [{ ...response }],
  };
}

export function mapStatsToIntelligence(
  query: string,
  response: Record<string, unknown>
): IntelligenceRecord {
  return {
    source: 'fofa',
    query,
    total: 1,
    results: [response],
  };
}
