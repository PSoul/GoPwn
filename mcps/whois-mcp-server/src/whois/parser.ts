import type { WhoisDomainResult, WhoisIpResult } from '../mappers/types.js';

function extractField(raw: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function extractMultiField(raw: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let match;
    while ((match = regex.exec(raw)) !== null) {
      if (match[1]) {
        const value = match[1].trim();
        if (value && !results.includes(value)) {
          results.push(value);
        }
      }
    }
  }
  return results;
}

export function parseDomainWhois(raw: string): WhoisDomainResult {
  const registrar = extractField(raw, [
    /Registrar:\s*(.+)/i,
    /Sponsoring Registrar:\s*(.+)/i,
    /registrar:\s*(.+)/i,
  ]);

  const creationDate = extractField(raw, [
    /Creation Date:\s*(.+)/i,
    /Created Date:\s*(.+)/i,
    /Registration Time:\s*(.+)/i,
    /created:\s*(.+)/i,
  ]);

  const expirationDate = extractField(raw, [
    /Registry Expiry Date:\s*(.+)/i,
    /Expiration Date:\s*(.+)/i,
    /Expiration Time:\s*(.+)/i,
    /expires:\s*(.+)/i,
  ]);

  const updatedDate = extractField(raw, [
    /Updated Date:\s*(.+)/i,
    /Last Updated:\s*(.+)/i,
    /updated:\s*(.+)/i,
  ]);

  const nameServers = extractMultiField(raw, [
    /Name Server:\s*(.+)/i,
    /nserver:\s*(.+)/i,
  ]).map((ns) => ns.toLowerCase());

  const status = extractMultiField(raw, [
    /Domain Status:\s*(.+)/i,
    /Status:\s*(.+)/i,
  ]);

  const registrant = extractField(raw, [
    /Registrant Organization:\s*(.+)/i,
    /Registrant Name:\s*(.+)/i,
    /Registrant:\s*(.+)/i,
  ]);

  return {
    raw,
    parsed: {
      registrar,
      creationDate,
      expirationDate,
      updatedDate,
      nameServers,
      status,
      registrant,
    },
  };
}

export function parseIpWhois(raw: string): WhoisIpResult {
  const netRange = extractField(raw, [
    /NetRange:\s*(.+)/i,
    /inetnum:\s*(.+)/i,
  ]);

  const cidr = extractField(raw, [
    /CIDR:\s*(.+)/i,
    /route:\s*(.+)/i,
  ]);

  const organization = extractField(raw, [
    /Organization:\s*(.+)/i,
    /OrgName:\s*(.+)/i,
    /org-name:\s*(.+)/i,
    /descr:\s*(.+)/i,
  ]);

  const country = extractField(raw, [
    /Country:\s*(.+)/i,
    /country:\s*(.+)/i,
  ]);

  const asn = extractField(raw, [
    /OriginAS:\s*(.+)/i,
    /origin:\s*(.+)/i,
  ]);

  const description = extractField(raw, [
    /NetName:\s*(.+)/i,
    /netname:\s*(.+)/i,
  ]);

  return {
    raw,
    parsed: {
      netRange,
      cidr,
      organization,
      country,
      asn,
      description,
    },
  };
}
