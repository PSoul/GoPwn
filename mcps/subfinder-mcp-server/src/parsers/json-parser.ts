import type { SubfinderResult } from '../mappers/types.js';

export function parseSubfinderOutput(raw: string): SubfinderResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as SubfinderResult[];
    return [parsed as SubfinderResult];
  } catch {
    // Fall back to JSONL (one JSON object per line)
  }

  const lines = trimmed.split('\n').filter((line) => line.trim());
  const results: SubfinderResult[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line.trim()) as SubfinderResult);
    } catch {
      // Skip malformed lines
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to parse subfinder output: no valid JSON found');
  }

  return results;
}
