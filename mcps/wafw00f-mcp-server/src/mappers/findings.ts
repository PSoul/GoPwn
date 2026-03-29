import type { Wafw00fResult, Finding } from './types.js';

export function mapToFindings(results: Wafw00fResult[]): Finding[] {
  return results.map((r) => ({
    host: r.url,
    type: 'waf-detected',
    severity: 'info',
    title: r.detected ? `WAF Detected: ${r.firewall}` : 'No WAF Detected',
    description: r.detected
      ? `Target is protected by ${r.firewall} from ${r.manufacturer}`
      : 'No WAF was detected on target',
    evidence: { wafName: r.firewall, manufacturer: r.manufacturer, detected: r.detected },
  }));
}
