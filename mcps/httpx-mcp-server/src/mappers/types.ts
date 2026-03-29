// httpx JSON output types
export interface HttpxResult {
  url: string;
  status_code: number;
  title: string;
  webserver: string;
  content_length: number;
  tech?: string[];
  final_url?: string;
}

// Mapped output types
export interface WebEntryRecord {
  url: string;
  statusCode: number;
  title: string;
  server: string;
  contentLength: number;
  technologies: string[];
  redirectUrl?: string;
}
