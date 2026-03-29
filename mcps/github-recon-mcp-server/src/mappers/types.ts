export interface IntelligenceRecord {
  source: 'github-code' | 'github-repo' | 'github-commit';
  query: string;
  total: number;
  results: Array<Record<string, unknown>>;
}
