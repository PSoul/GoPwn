import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  aesEncrypt,
  aesDecrypt,
  randomString,
  jwtDecode,
  uuidGenerate,
} from '../codec/crypto.js';

export function registerCryptoUtil(server: McpServer) {
  server.tool(
    'crypto_util',
    'Cryptographic utilities: AES encrypt/decrypt, random string generation, JWT decode, UUID generation',
    {
      operation: z
        .enum(['aes-encrypt', 'aes-decrypt', 'random-string', 'jwt-decode', 'uuid-generate'])
        .describe('The cryptographic operation to perform'),
      data: z.string().optional().describe('Input data for AES operations'),
      key: z.string().optional().describe('Encryption key in hex format (for AES operations)'),
      iv: z.string().optional().describe('Initialization vector in hex format (for AES operations)'),
      mode: z
        .enum(['cbc', 'gcm'])
        .optional()
        .default('cbc')
        .describe('AES mode of operation'),
      authTag: z
        .string()
        .optional()
        .describe('Authentication tag in hex format (for AES-GCM decrypt)'),
      length: z.number().optional().default(32).describe('Length for random string generation'),
      charset: z
        .enum(['alphanumeric', 'hex', 'base64', 'ascii'])
        .optional()
        .describe('Character set for random string generation'),
      token: z.string().optional().describe('JWT token to decode'),
    },
    async ({ operation, data, key, iv, mode, authTag, length, charset, token }) => {
      try {
        switch (operation) {
          case 'aes-encrypt': {
            if (!data || !key) {
              throw new Error('AES encrypt requires data and key parameters');
            }
            const encResult = aesEncrypt(data, key, iv, mode);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      result: encResult.ciphertext,
                      operation,
                      details: {
                        iv: encResult.iv,
                        mode: encResult.mode,
                        ...(encResult.authTag ? { authTag: encResult.authTag } : {}),
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'aes-decrypt': {
            if (!data || !key || !iv) {
              throw new Error('AES decrypt requires data, key, and iv parameters');
            }
            const decResult = aesDecrypt(data, key, iv, mode, authTag);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      result: decResult.plaintext,
                      operation,
                      details: { mode: decResult.mode },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'random-string': {
            const str = randomString(length, charset);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      result: str,
                      operation,
                      details: { length: str.length, charset: charset ?? 'alphanumeric' },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'jwt-decode': {
            if (!token) {
              throw new Error('JWT decode requires a token parameter');
            }
            const decoded = jwtDecode(token);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      result: decoded,
                      operation,
                      details: { algorithm: decoded.header.alg, type: decoded.header.typ },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'uuid-generate': {
            const uuid = uuidGenerate();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      result: uuid,
                      operation,
                      details: { version: 4 },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Crypto error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
