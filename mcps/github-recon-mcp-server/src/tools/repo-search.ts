import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GitHubClient } from '../github/api-client.js';
import { mapRepoSearchToIntelligence } from '../mappers/intelligence.js';

export function registerRepoSearch(server: McpServer) {
  server.tool(
    'github_repo_search',
    'Search GitHub repositories for reconnaissance (authorized pentest recon)',
    {
      query: z.string().describe('Search query for repositories'),
      sort: z
        .enum(['stars', 'forks', 'updated', 'best-match'])
        .optional()
        .default('best-match')
        .describe('Sort order'),
      perPage: z
        .number()
        .optional()
        .default(30)
        .describe('Results per page (max 100)'),
      page: z.number().optional().default(1).describe('Page number'),
    },
    async ({ query, sort, perPage, page }) => {
      const client = new GitHubClient();
      const response = await client.searchRepos(query, sort, perPage, page);
      const intelligence = mapRepoSearchToIntelligence(query, response);

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
