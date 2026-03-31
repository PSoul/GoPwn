import type { HttpRequestOptions, HttpResponse } from './types.js';

// Allow self-signed / invalid TLS certificates (common in security testing targets)
// Node 18+ honours this env var for its built-in fetch implementation.
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function sendHttpRequest(opts: HttpRequestOptions): Promise<HttpResponse> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), (opts.timeout ?? 10) * 1000);

  try {
    const res = await fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
      redirect: opts.followRedirects !== false ? 'follow' : 'manual',
      signal: controller.signal,
    });

    const bodyText = await res.text();
    const truncated =
      bodyText.length > 1_048_576
        ? bodyText.slice(0, 1_048_576) + '\n[truncated]'
        : bodyText;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return {
      statusCode: res.status,
      headers,
      body: truncated,
      timing: { total: Date.now() - start },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
