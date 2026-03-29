import type { HttpxResult, WebEntryRecord } from './types.js';

export function mapToWebEntries(results: HttpxResult[]): WebEntryRecord[] {
  return results.map((r) => {
    const entry: WebEntryRecord = {
      url: r.url,
      statusCode: r.status_code,
      title: r.title,
      server: r.webserver,
      contentLength: r.content_length,
      technologies: r.tech ?? [],
    };
    if (r.final_url) {
      entry.redirectUrl = r.final_url;
    }
    return entry;
  });
}
