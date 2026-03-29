import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { udpSend } from '../net/udp-client.js';

export function registerUdpSend(server: McpServer) {
  server.tool(
    'udp_send',
    'Send a UDP packet and receive response',
    {
      host: z.string().describe('Target hostname or IP address'),
      port: z.number().describe('Target port number'),
      data: z.string().describe('Data to send'),
      encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe('Encoding of the data parameter'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
    },
    async ({ host, port, data, encoding, timeout }) => {
      try {
        const result = await udpSend({ host, port, data, encoding, timeout });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: (err as Error).message,
            },
          ],
        };
      }
    }
  );
}
