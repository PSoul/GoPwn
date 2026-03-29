import type {
  GitHubCodeSearchResponse,
  GitHubRepoSearchResponse,
  GitHubCommitSearchResponse,
} from './types.js';

export class GitHubClient {
  private token: string | undefined;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
  }

  private async request(path: string, accept?: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { headers });

    // Check rate limit
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const resetTime = res.headers.get('X-RateLimit-Reset');
    if (remaining === '0') {
      const resetDate = new Date(Number(resetTime) * 1000);
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`
      );
    }

    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async searchCode(
    query: string,
    perPage: number,
    page: number
  ): Promise<GitHubCodeSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      per_page: String(perPage),
      page: String(page),
    });
    return this.request(
      `/search/code?${params.toString()}`,
      'application/vnd.github.text-match+json'
    );
  }

  async searchRepos(
    query: string,
    sort: string,
    perPage: number,
    page: number
  ): Promise<GitHubRepoSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      per_page: String(perPage),
      page: String(page),
    });
    if (sort !== 'best-match') params.set('sort', sort);
    return this.request(`/search/repositories?${params.toString()}`);
  }

  async searchCommits(
    query: string,
    sort: string,
    perPage: number,
    page: number
  ): Promise<GitHubCommitSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      per_page: String(perPage),
      page: String(page),
    });
    if (sort !== 'best-match') params.set('sort', sort);
    return this.request(
      `/search/commits?${params.toString()}`,
      'application/vnd.github.cloak-preview+json'
    );
  }
}
