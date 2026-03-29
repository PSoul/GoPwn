import type { ScanResult } from '../mappers/types.js';

export function parseFscanOutput(raw: string): ScanResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as ScanResult[];
    return [parsed as ScanResult];
  } catch {
    // Fall back to JSONL (one JSON object per line)
  }

  const lines = trimmed.split('\n').filter((line) => line.trim());
  const results: ScanResult[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line.trim()) as ScanResult);
    } catch {
      // Skip malformed lines
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to parse fscan output: no valid JSON found');
  }

  return results;
}
