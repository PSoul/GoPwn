export interface AfrogResult {
  pocinfo: {
    id: string;
    name: string;
    severity: string;
    author: string;
  };
  target: string;
  fulloutput: string;
  result: string;
}

export interface Finding {
  host: string;
  port?: number;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  pocId: string;
  evidence?: Record<string, unknown>;
}

export interface PocEntry {
  id: string;
  name: string;
  severity: string;
}
