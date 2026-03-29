// fscan JSON output types
export interface ScanResult {
  time: string;
  type: 'HOST' | 'PORT' | 'SERVICE' | 'VULN';
  target: string;
  status: string;
  details: Record<string, unknown>;
}

// Result mapping types (aligned with llmpentest-mcp-template schemas)

export interface NetworkRecord {
  host: string;
  port: number;
  protocol: string;
  service: string;
  fingerprint?: string;
  version?: string;
}

export interface Finding {
  host: string;
  port?: number;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
}

export interface Asset {
  type: 'ip';
  address: string;
  ports?: Array<{
    port: number;
    protocol: string;
    service?: string;
    fingerprint?: string;
  }>;
  os?: string;
  alive: boolean;
}
