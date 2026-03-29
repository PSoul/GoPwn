import type { ScanResult, Finding } from './types.js';

const CRITICAL_VULNS = new Set(['MS17-010', 'DOUBLEPULSAR']);
const HIGH_VULNS = new Set(['smbghost']);

function getSeverity(vulnType: string): Finding['severity'] {
  if (CRITICAL_VULNS.has(vulnType)) return 'critical';
  if (HIGH_VULNS.has(vulnType)) return 'high';
  if (vulnType === 'weak-password') return 'high';
  if (vulnType === 'unauthorized') return 'high';
  return 'medium';
}

function buildTitle(r: ScanResult): string {
  const service = r.details.service ? String(r.details.service) : '';
  const vulnType = String(r.details.type ?? 'unknown');

  if (vulnType === 'weak-password') {
    return `${service} weak password: ${r.details.username}`;
  }
  if (vulnType === 'unauthorized') {
    return `${service} unauthorized access`;
  }
  return `${vulnType} on ${r.target}`;
}

function buildDescription(r: ScanResult): string {
  const parts: string[] = [`Target: ${r.target}`];
  if (r.details.port) parts.push(`Port: ${r.details.port}`);
  if (r.details.os) parts.push(`OS: ${r.details.os}`);
  if (r.details.username) parts.push(`Username: ${r.details.username}`);
  if (r.details.password) parts.push(`Password: ${r.details.password}`);
  return parts.join(', ');
}

export function mapToFindings(results: ScanResult[]): Finding[] {
  return results
    .filter((r) => r.type === 'VULN')
    .map((r) => {
      const vulnType = String(r.details.type ?? 'unknown');
      const finding: Finding = {
        host: r.target,
        type: vulnType,
        severity: getSeverity(vulnType),
        title: buildTitle(r),
        description: buildDescription(r),
      };
      if (r.details.port) finding.port = Number(r.details.port);
      if (r.details.username || r.details.password) {
        finding.evidence = {
          username: r.details.username,
          password: r.details.password,
        };
      }
      return finding;
    });
}
