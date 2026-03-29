import type { DirsearchResult, DirsearchOutput } from '../mappers/types.js';

export function parseDirsearchOutput(raw: string): DirsearchResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);

    // dirsearch outputs {"results": [...]}
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.results)) {
      return (parsed as DirsearchOutput).results;
    }

    // Fallback: raw array
    if (Array.isArray(parsed)) {
      return parsed as DirsearchResult[];
    }

    throw new Error('Unexpected JSON structure: missing "results" array');
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse dirsearch output: invalid JSON');
    }
    throw err;
  }
}
