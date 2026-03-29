export const WHOIS_SERVERS: Record<string, string> = {
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'cn': 'whois.cnnic.cn',
  'io': 'whois.nic.io',
  'dev': 'whois.nic.google',
  'app': 'whois.nic.google',
  'info': 'whois.afilias.net',
  'me': 'whois.nic.me',
  'cc': 'ccwhois.verisign-grs.com',
  'tv': 'tvwhois.verisign-grs.com',
};

export const FALLBACK_SERVER = 'whois.iana.org';

export function getWhoisServer(domain: string): string {
  const parts = domain.split('.');
  const tld = parts[parts.length - 1].toLowerCase();
  return WHOIS_SERVERS[tld] ?? FALLBACK_SERVER;
}

export const IP_WHOIS_SERVER = 'whois.arin.net';
