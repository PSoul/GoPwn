import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tcpBannerGrab } from '../net/tcp-client.js';

export function registerBannerGrab(server: McpServer) {
  server.tool(
    'tcp_banner_grab',
    'TCP banner grab — connect and read server banner without sending data',
    {
      host: z.string().describe('Target hostname or IP address'),
      port: z.number().describe('Target port number'),
      timeout: z.number().optional().default(5).describe('Timeout in seconds'),
    },
    async ({ host, port, timeout }) => {
      try {
        const result = await tcpBannerGrab({ host, port, timeout });
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
