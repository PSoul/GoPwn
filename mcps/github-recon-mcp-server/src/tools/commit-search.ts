import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GitHubClient } from '../github/api-client.js';
import { mapCommitSearchToIntelligence } from '../mappers/intelligence.js';

export function registerCommitSearch(server: McpServer) {
  server.tool(
    'github_commit_search',
    'Search GitHub commits for sensitive information (authorized pentest recon)',
    {
      query: z.string().describe('Search query for commits'),
      author: z.string().optional().describe('Filter by commit author'),
      repo: z
        .string()
        .optional()
        .describe('Filter by repository (owner/repo format)'),
      sort: z
        .enum(['author-date', 'committer-date', 'best-match'])
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
    async ({ query, author, repo, sort, perPage, page }) => {
      const parts = [query];
      if (author) parts.push(`author:${author}`);
      if (repo) parts.push(`repo:${repo}`);
      const fullQuery = parts.join('+');

      const client = new GitHubClient();
      const response = await client.searchCommits(fullQuery, sort, perPage, page);
      const intelligence = mapCommitSearchToIntelligence(fullQuery, response);

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
