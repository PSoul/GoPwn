export interface WhoisDomainResult {
  raw: string;
  parsed: {
    registrar: string;
    creationDate: string;
    expirationDate: string;
    updatedDate: string;
    nameServers: string[];
    status: string[];
    registrant: string;
  };
}

export interface WhoisIpResult {
  raw: string;
  parsed: {
    netRange: string;
    cidr: string;
    organization: string;
    country: string;
    asn: string;
    description: string;
  };
}

export interface IcpRecord {
  domain: string;
  icp: string;
  nature: string;
  unitName: string;
  updateTime: string;
}

export interface IntelligenceRecord {
  source: 'icp';
  query: string;
  total: number;
  results: IcpRecord[];
}
