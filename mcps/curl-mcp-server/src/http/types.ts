export interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  followRedirects?: boolean;
  timeout?: number;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  timing: { total: number };
}

export interface RawRequestOptions {
  host: string;
  port: number;
  rawRequest: string;
  tls?: boolean;
  timeout?: number;
}

export interface RawHttpResponse {
  rawResponse: string;
  timing: { connect: number; total: number };
}
