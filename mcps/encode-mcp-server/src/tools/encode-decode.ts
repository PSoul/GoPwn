import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { encode, decode } from '../codec/encoder.js';

export function registerEncodeDecode(server: McpServer) {
  server.tool(
    'encode_decode',
    'Encode or decode data using various algorithms (base64, hex, URL, HTML, unicode, etc.)',
    {
      input: z.string().describe('The string to encode or decode'),
      operation: z.enum(['encode', 'decode']).describe('Whether to encode or decode'),
      algorithm: z
        .enum(['base64', 'base64url', 'url', 'hex', 'html', 'unicode', 'utf8'])
        .describe('The encoding algorithm to use'),
      options: z
        .object({
          doubleEncode: z.boolean().optional().describe('Apply double URL encoding'),
          charset: z.string().optional().describe('Character set specification'),
        })
        .optional()
        .describe('Additional options for encoding'),
    },
    async ({ input, operation, algorithm, options }) => {
      try {
        const result =
          operation === 'encode'
            ? encode(input, algorithm, options)
            : decode(input, algorithm, options);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  result,
                  algorithm,
                  operation,
                  inputLength: input.length,
                  outputLength: result.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Encoding error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
