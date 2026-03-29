// subfinder JSONL output type
export interface SubfinderResult {
  host: string;
  input: string;
  source: string;
}

// Mapped domain record
export interface DomainRecord {
  domain: string;
  host: string;
  source: string;
}
