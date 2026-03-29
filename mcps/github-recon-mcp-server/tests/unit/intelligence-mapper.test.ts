import { describe, it, expect } from 'vitest';
import {
  mapCodeSearchToIntelligence,
  mapRepoSearchToIntelligence,
  mapCommitSearchToIntelligence,
} from '../../src/mappers/intelligence.js';
import type {
  GitHubCodeSearchResponse,
  GitHubRepoSearchResponse,
  GitHubCommitSearchResponse,
} from '../../src/github/types.js';
import codeSearchFixture from '../fixtures/code-search.json';
import repoSearchFixture from '../fixtures/repo-search.json';
import commitSearchFixture from '../fixtures/commit-search.json';

describe('mapCodeSearchToIntelligence', () => {
  it('maps code search response correctly', () => {
    const result = mapCodeSearchToIntelligence(
      'example.com password',
      codeSearchFixture as GitHubCodeSearchResponse
    );

    expect(result.source).toBe('github-code');
    expect(result.query).toBe('example.com password');
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first.repository).toBe('testorg/testrepo');
    expect(first.path).toBe('deploy/config.yml');
    expect(first.filename).toBe('config.yml');
    expect(first.url).toBe(
      'https://github.com/testorg/testrepo/blob/main/deploy/config.yml'
    );
    expect(first.score).toBe(1.5);
    expect(first.textMatches).toEqual(['password: s3cret123']);
  });

  it('handles items without text_matches', () => {
    const response: GitHubCodeSearchResponse = {
      total_count: 1,
      incomplete_results: false,
      items: [
        {
          name: 'test.txt',
          path: 'test.txt',
          sha: 'abc',
          url: 'https://api.github.com/repos/org/repo/contents/test.txt',
          html_url: 'https://github.com/org/repo/blob/main/test.txt',
          score: 1.0,
          repository: {
            full_name: 'org/repo',
            html_url: 'https://github.com/org/repo',
            description: null,
          },
        },
      ],
    };

    const result = mapCodeSearchToIntelligence('test', response);
    expect(result.results[0].textMatches).toEqual([]);
  });
});

describe('mapRepoSearchToIntelligence', () => {
  it('maps repo search response correctly', () => {
    const result = mapRepoSearchToIntelligence(
      'testorg',
      repoSearchFixture as GitHubRepoSearchResponse
    );

    expect(result.source).toBe('github-repo');
    expect(result.query).toBe('testorg');
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first.fullName).toBe('testorg/internal-tools');
    expect(first.description).toBe('Internal tooling repository');
    expect(first.url).toBe('https://github.com/testorg/internal-tools');
    expect(first.language).toBe('Python');
    expect(first.stars).toBe(42);
    expect(first.forks).toBe(5);
    expect(first.updatedAt).toBe('2025-01-15T10:30:00Z');
    expect(first.topics).toEqual(['internal', 'tools', 'automation']);
  });
});

describe('mapCommitSearchToIntelligence', () => {
  it('maps commit search response correctly', () => {
    const result = mapCommitSearchToIntelligence(
      'credentials',
      commitSearchFixture as GitHubCommitSearchResponse
    );

    expect(result.source).toBe('github-commit');
    expect(result.query).toBe('credentials');
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first.repository).toBe('testorg/testrepo');
    expect(first.sha).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(first.message).toBe('fix: remove hardcoded credentials from config');
    expect(first.author).toBe('Test User');
    expect(first.date).toBe('2025-01-10T08:00:00Z');
    expect(first.url).toContain('github.com/testorg/testrepo/commit/');
  });
});
