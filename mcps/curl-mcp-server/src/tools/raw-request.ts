import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendRawRequest } from '../http/raw-client.js';

export function registerRawRequest(server: McpServer) {
  server.tool(
    'http_raw_request',
    'Send a raw HTTP packet via TCP socket',
    {
      host: z.string().describe('Target host'),
      port: z.number().describe('Target port'),
      rawRequest: z.string().describe('Full raw HTTP request text'),
      tls: z.boolean().optional().default(false).describe('Use TLS'),
      timeout: z
        .number()
        .optional()
        .default(10)
        .describe('Timeout in seconds'),
    },
    async ({ host, port, rawRequest, tls, timeout }) => {
      try {
        const result = await sendRawRequest({
          host,
          port,
          rawRequest,
          tls,
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
