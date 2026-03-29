export interface FofaSearchResponse {
  error: boolean;
  errmsg?: string;
  size: number;
  results: string[][];
}

export interface FofaHostResponse {
  error: boolean;
  host: string;
  ip: string;
  ports: number[];
  [key: string]: unknown;
}

export interface IntelligenceRecord {
  source: 'fofa';
  query: string;
  total: number;
  results: Array<Record<string, unknown>>;
}
