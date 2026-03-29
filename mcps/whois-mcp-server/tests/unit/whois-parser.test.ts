import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDomainWhois } from '../../src/whois/parser.js';
import { parseIpWhois } from '../../src/whois/parser.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('parseDomainWhois', () => {
  const raw = readFileSync(join(fixturesDir, 'whois-domain.txt'), 'utf-8');

  it('extracts registrar', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.registrar).toBe('RESERVED-Internet Assigned Numbers Authority');
  });

  it('extracts creation date', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.creationDate).toBe('1995-08-14T04:00:00Z');
  });

  it('extracts expiration date', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.expirationDate).toBe('2025-08-13T04:00:00Z');
  });

  it('extracts updated date', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.updatedDate).toBe('2024-08-14T07:01:38Z');
  });

  it('extracts name servers', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.nameServers).toEqual([
      'a.iana-servers.net',
      'b.iana-servers.net',
    ]);
  });

  it('extracts domain status', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.status).toHaveLength(3);
    expect(result.parsed.status[0]).toContain('clientDeleteProhibited');
  });

  it('extracts registrant organization', () => {
    const result = parseDomainWhois(raw);
    expect(result.parsed.registrant).toBe('Internet Assigned Numbers Authority');
  });

  it('preserves raw text', () => {
    const result = parseDomainWhois(raw);
    expect(result.raw).toBe(raw);
  });

  it('handles empty whois response', () => {
    const result = parseDomainWhois('');
    expect(result.parsed.registrar).toBe('');
    expect(result.parsed.nameServers).toEqual([]);
    expect(result.parsed.status).toEqual([]);
  });
});

describe('parseIpWhois', () => {
  const raw = readFileSync(join(fixturesDir, 'whois-ip.txt'), 'utf-8');

  it('extracts net range', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.netRange).toBe('8.8.8.0 - 8.8.8.255');
  });

  it('extracts CIDR', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.cidr).toBe('8.8.8.0/24');
  });

  it('extracts organization', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.organization).toBe('Google LLC (GOGL)');
  });

  it('extracts country', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.country).toBe('US');
  });

  it('extracts ASN', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.asn).toBe('AS15169');
  });

  it('extracts description (NetName)', () => {
    const result = parseIpWhois(raw);
    expect(result.parsed.description).toBe('LVLT-GOGL-8-8-8');
  });

  it('preserves raw text', () => {
    const result = parseIpWhois(raw);
    expect(result.raw).toBe(raw);
  });
});
