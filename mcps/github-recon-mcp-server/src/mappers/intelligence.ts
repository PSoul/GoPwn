import type {
  GitHubCodeSearchResponse,
  GitHubRepoSearchResponse,
  GitHubCommitSearchResponse,
} from '../github/types.js';
import type { IntelligenceRecord } from './types.js';

export function mapCodeSearchToIntelligence(
  query: string,
  response: GitHubCodeSearchResponse
): IntelligenceRecord {
  return {
    source: 'github-code',
    query,
    total: response.total_count,
    results: response.items.map((item) => ({
      repository: item.repository.full_name,
      path: item.path,
      filename: item.name,
      url: item.html_url,
      score: item.score,
      textMatches: item.text_matches?.map((m) => m.fragment) ?? [],
    })),
  };
}

export function mapRepoSearchToIntelligence(
  query: string,
  response: GitHubRepoSearchResponse
): IntelligenceRecord {
  return {
    source: 'github-repo',
    query,
    total: response.total_count,
    results: response.items.map((item) => ({
      fullName: item.full_name,
      description: item.description,
      url: item.html_url,
      language: item.language,
      stars: item.stargazers_count,
      forks: item.forks_count,
      updatedAt: item.updated_at,
      topics: item.topics,
    })),
  };
}

export function mapCommitSearchToIntelligence(
  query: string,
  response: GitHubCommitSearchResponse
): IntelligenceRecord {
  return {
    source: 'github-commit',
    query,
    total: response.total_count,
    results: response.items.map((item) => ({
      repository: item.repository.full_name,
      sha: item.sha,
      message: item.commit.message,
      author: item.commit.author.name,
      date: item.commit.author.date,
      url: item.html_url,
    })),
  };
}
