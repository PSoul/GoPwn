import type { Wafw00fResult } from '../mappers/types.js';

export function parseWafw00fOutput(raw: string): Wafw00fResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as Wafw00fResult[];
    return [parsed as Wafw00fResult];
  } catch {
    // Fall back to JSONL (one JSON object per line)
  }

  const lines = trimmed.split('\n').filter((line) => line.trim());
  const results: Wafw00fResult[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line.trim()) as Wafw00fResult);
    } catch {
      // Skip malformed lines
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to parse wafw00f output: no valid JSON found');
  }

  return results;
}
