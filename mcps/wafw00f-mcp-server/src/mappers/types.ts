export interface Wafw00fResult {
  url: string;
  detected: boolean;
  firewall: string;
  manufacturer: string;
}

export interface Finding {
  host: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
}
