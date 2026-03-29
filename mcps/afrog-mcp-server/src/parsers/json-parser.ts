import type { AfrogResult } from '../mappers/types.js';

export function parseAfrogOutput(raw: string): AfrogResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as AfrogResult[];
    return [parsed as AfrogResult];
  } catch {
    // Fall back to JSONL (one JSON object per line)
  }

  const lines = trimmed.split('\n').filter((line) => line.trim());
  const results: AfrogResult[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line.trim()) as AfrogResult);
    } catch {
      // Skip malformed lines
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to parse afrog output: no valid JSON found');
  }

  return results;
}
