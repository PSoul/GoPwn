// dirsearch JSON output types
export interface DirsearchOutput {
  results: DirsearchResult[];
}

export interface DirsearchResult {
  status: number;
  url: string;
  'content-length': number;
  redirect: string;
}

// Mapped output type
export interface WebEntryRecord {
  url: string;
  statusCode: number;
  contentLength: number;
  redirectUrl?: string;
}
