import type { HttpxResult } from '../mappers/types.js';

export function parseHttpxOutput(raw: string): HttpxResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as HttpxResult[];
    return [parsed as HttpxResult];
  } catch {
    // Fall back to JSONL (one JSON object per line)
  }

  const lines = trimmed.split('\n').filter((line) => line.trim());
  const results: HttpxResult[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line.trim()) as HttpxResult);
    } catch {
      // Skip malformed lines
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to parse httpx output: no valid JSON found');
  }

  return results;
}
