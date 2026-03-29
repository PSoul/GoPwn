export interface GitHubCodeSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubCodeSearchItem[];
}

export interface GitHubCodeSearchItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  score: number;
  repository: {
    full_name: string;
    html_url: string;
    description: string | null;
  };
  text_matches?: Array<{
    fragment: string;
    matches: Array<{
      text: string;
      indices: number[];
    }>;
  }>;
}

export interface GitHubRepoSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepoSearchItem[];
}

export interface GitHubRepoSearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics: string[];
}

export interface GitHubCommitSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubCommitSearchItem[];
}

export interface GitHubCommitSearchItem {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  repository: {
    full_name: string;
    html_url: string;
  };
}
