import type { DirsearchResult, WebEntryRecord } from './types.js';

export function mapToWebEntries(results: DirsearchResult[]): WebEntryRecord[] {
  return results.map((r) => {
    const entry: WebEntryRecord = {
      url: r.url,
      statusCode: r.status,
      contentLength: r['content-length'],
    };
    if (r.redirect) {
      entry.redirectUrl = r.redirect;
    }
    return entry;
  });
}
