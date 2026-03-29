import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GitHubClient } from '../github/api-client.js';
import { mapCodeSearchToIntelligence } from '../mappers/intelligence.js';

export function registerCodeSearch(server: McpServer) {
  server.tool(
    'github_code_search',
    'Search GitHub code for leaked credentials, secrets, or sensitive files (authorized pentest recon)',
    {
      query: z.string().describe('Search keywords, e.g. "example.com password"'),
      organization: z
        .string()
        .optional()
        .describe('Limit to organization or user'),
      language: z.string().optional().describe('Programming language filter'),
      filename: z.string().optional().describe('Filename filter'),
      extension: z.string().optional().describe('File extension filter'),
      perPage: z
        .number()
        .optional()
        .default(30)
        .describe('Results per page (max 100)'),
      page: z.number().optional().default(1).describe('Page number'),
    },
    async ({ query, organization, language, filename, extension, perPage, page }) => {
      const parts = [query];
      if (organization) parts.push(`org:${organization}`);
      if (language) parts.push(`language:${language}`);
      if (filename) parts.push(`filename:${filename}`);
      if (extension) parts.push(`extension:${extension}`);
      const fullQuery = parts.join('+');

      const client = new GitHubClient();
      const response = await client.searchCode(fullQuery, perPage, page);
      const intelligence = mapCodeSearchToIntelligence(fullQuery, response);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ intelligence }, null, 2),
          },
        ],
      };
    }
  );
}
