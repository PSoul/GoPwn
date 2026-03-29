import type { FofaSearchResponse, FofaHostResponse } from '../mappers/types.js';

export class FofaClient {
  private email: string;
  private key: string;
  private baseUrl = 'https://fofa.info/api/v1';

  constructor() {
    this.email = process.env.FOFA_EMAIL ?? '';
    this.key = process.env.FOFA_KEY ?? '';
    if (!this.email || !this.key) {
      throw new Error('FOFA_EMAIL and FOFA_KEY environment variables are required');
    }
  }

  async search(
    query: string,
    fields: string[],
    size: number,
    page: number
  ): Promise<FofaSearchResponse> {
    const qbase64 = Buffer.from(query).toString('base64');
    const url = `${this.baseUrl}/search/all?email=${encodeURIComponent(this.email)}&key=${encodeURIComponent(this.key)}&qbase64=${qbase64}&fields=${fields.join(',')}&size=${size}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FOFA API error: ${res.status}`);
    return res.json() as Promise<FofaSearchResponse>;
  }

  async host(host: string): Promise<FofaHostResponse> {
    const url = `${this.baseUrl}/host/${encodeURIComponent(host)}?email=${encodeURIComponent(this.email)}&key=${encodeURIComponent(this.key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FOFA API error: ${res.status}`);
    return res.json() as Promise<FofaHostResponse>;
  }

  async stats(query: string, fields: string[]): Promise<Record<string, unknown>> {
    const qbase64 = Buffer.from(query).toString('base64');
    const url = `${this.baseUrl}/search/stats?email=${encodeURIComponent(this.email)}&key=${encodeURIComponent(this.key)}&qbase64=${qbase64}&fields=${fields.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FOFA API error: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }
}
