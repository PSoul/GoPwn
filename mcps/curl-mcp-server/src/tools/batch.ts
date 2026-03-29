import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendHttpRequest } from '../http/client.js';

export function registerHttpBatch(server: McpServer) {
  server.tool(
    'http_batch',
    'Batch HTTP requests with concurrency control',
    {
      requests: z
        .array(
          z.object({
            url: z.string(),
            method: z.string().optional(),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
          })
        )
        .describe('Array of HTTP requests'),
      concurrency: z
        .number()
        .optional()
        .default(5)
        .describe('Max concurrent requests'),
      timeout: z
        .number()
        .optional()
        .default(10)
        .describe('Timeout per request in seconds'),
    },
    async ({ requests, concurrency, timeout }) => {
      const results: Array<{
        url: string;
        statusCode?: number;
        headers?: Record<string, string>;
        body?: string;
        error?: string;
      }> = [];

      // Simple promise pool
      let index = 0;
      const workers = Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
        while (index < requests.length) {
          const i = index++;
          const req = requests[i];
          try {
            const res = await sendHttpRequest({
              url: req.url,
              method: req.method,
              headers: req.headers,
              body: req.body,
              timeout,
            });
            results[i] = {
              url: req.url,
              statusCode: res.statusCode,
              headers: res.headers,
              body: res.body,
            };
          } catch (error) {
            results[i] = {
              url: req.url,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      });

      await Promise.all(workers);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ results }, null, 2),
          },
        ],
      };
    }
  );
}
