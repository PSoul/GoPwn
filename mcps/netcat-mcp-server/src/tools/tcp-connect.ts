import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tcpConnect } from '../net/tcp-client.js';

export function registerTcpConnect(server: McpServer) {
  server.tool(
    'tcp_connect',
    'TCP connect to a host, optionally send data, and receive response',
    {
      host: z.string().describe('Target hostname or IP address'),
      port: z.number().describe('Target port number'),
      data: z.string().optional().describe('Data to send after connecting'),
      encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe('Encoding of the data parameter'),
      timeout: z.number().optional().default(5).describe('Timeout in seconds'),
      readUntilClose: z.boolean().optional().default(false).describe('Keep reading until the connection closes'),
    },
    async ({ host, port, data, encoding, timeout, readUntilClose }) => {
      try {
        const result = await tcpConnect({ host, port, data, encoding, timeout, readUntilClose });
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
