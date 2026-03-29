import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendHttpRequest } from '../http/client.js';

export function registerHttpRequest(server: McpServer) {
  server.tool(
    'http_request',
    'Send a custom HTTP request using fetch',
    {
      url: z.string().describe('Target URL'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
        .optional()
        .default('GET')
        .describe('HTTP method'),
      headers: z.record(z.string()).optional().describe('HTTP headers'),
      body: z.string().optional().describe('Request body'),
      followRedirects: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to follow redirects'),
      timeout: z
        .number()
        .optional()
        .default(10)
        .describe('Timeout in seconds'),
    },
    async ({ url, method, headers, body, followRedirects, timeout }) => {
      try {
        const result = await sendHttpRequest({
          url,
          method,
          headers,
          body,
          followRedirects,
          timeout,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
