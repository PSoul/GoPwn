import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mapToFindings } from '../../src/mappers/findings.js';
import type { Wafw00fResult } from '../../src/mappers/types.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('mapToFindings', () => {
  it('maps detected WAF to Finding', () => {
    const results: Wafw00fResult[] = JSON.parse(
      readFileSync(join(fixturesDir, 'waf-detected.json'), 'utf-8')
    );
    const findings = mapToFindings(results);

    expect(findings).toHaveLength(1);
    expect(findings[0].host).toBe('https://example.com');
    expect(findings[0].type).toBe('waf-detected');
    expect(findings[0].severity).toBe('info');
    expect(findings[0].title).toBe('WAF Detected: Cloudflare');
    expect(findings[0].description).toBe('Target is protected by Cloudflare from Cloudflare Inc.');
    expect(findings[0].evidence).toEqual({
      wafName: 'Cloudflare',
      manufacturer: 'Cloudflare Inc.',
      detected: true,
    });
  });

  it('maps no-WAF result to Finding', () => {
    const results: Wafw00fResult[] = JSON.parse(
      readFileSync(join(fixturesDir, 'no-waf.json'), 'utf-8')
    );
    const findings = mapToFindings(results);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('No WAF Detected');
    expect(findings[0].description).toBe('No WAF was detected on target');
    expect(findings[0].evidence).toEqual({
      wafName: '',
      manufacturer: '',
      detected: false,
    });
  });

  it('handles empty results', () => {
    expect(mapToFindings([])).toEqual([]);
  });
});
