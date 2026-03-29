import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeHash } from '../codec/hasher.js';

export function registerHashCompute(server: McpServer) {
  server.tool(
    'hash_compute',
    'Compute hash digests using various algorithms (MD5, SHA-1, SHA-256, SHA-512, SHA3)',
    {
      input: z.string().describe('The string to hash'),
      algorithm: z
        .enum(['md5', 'sha1', 'sha256', 'sha512', 'sha3-256', 'sha3-512'])
        .describe('The hash algorithm to use'),
      hmacKey: z.string().optional().describe('HMAC key (if provided, computes HMAC instead)'),
      outputFormat: z
        .enum(['hex', 'base64'])
        .optional()
        .default('hex')
        .describe('Output format for the hash digest'),
      inputEncoding: z
        .enum(['utf8', 'hex', 'base64'])
        .optional()
        .default('utf8')
        .describe('Encoding of the input string'),
    },
    async ({ input, algorithm, hmacKey, outputFormat, inputEncoding }) => {
      try {
        const hash = computeHash(input, algorithm, {
          hmacKey,
          outputFormat,
          inputEncoding,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  hash,
                  algorithm,
                  isHmac: !!hmacKey,
                  outputFormat,
                  inputLength: input.length,
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
              text: `Hash error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
