import type { IcpRecord, IntelligenceRecord } from '../mappers/types.js';

const DEFAULT_API_URL = 'https://api.vvhan.com/api/icp';
const BACKUP_API_URL = 'https://api.66mz8.com/api/icp';

export async function queryIcp(
  query: string,
  timeout: number = 10000
): Promise<IntelligenceRecord> {
  const apiUrl = process.env.ICP_API_URL ?? DEFAULT_API_URL;

  try {
    return await fetchIcp(apiUrl, query, timeout);
  } catch (primaryError) {
    // If custom URL was set, don't fallback
    if (process.env.ICP_API_URL) {
      throw primaryError;
    }
    // Try backup API
    try {
      return await fetchIcpBackup(BACKUP_API_URL, query, timeout);
    } catch {
      // Throw the original error if backup also fails
      throw primaryError;
    }
  }
}

async function fetchIcp(
  baseUrl: string,
  query: string,
  timeout: number
): Promise<IntelligenceRecord> {
  const url = `${baseUrl}?info=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`ICP API error: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;

  if (!data.success && !data.info) {
    throw new Error(`ICP API returned no results for: ${query}`);
  }

  const record = mapPrimaryResponse(query, data);
  return record;
}

async function fetchIcpBackup(
  baseUrl: string,
  query: string,
  timeout: number
): Promise<IntelligenceRecord> {
  const url = `${baseUrl}?url=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`ICP backup API error: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const record = mapBackupResponse(query, data);
  return record;
}

function mapPrimaryResponse(
  query: string,
  data: Record<string, unknown>
): IntelligenceRecord {
  const info = (data.info ?? data) as Record<string, string>;
  const icpRecord: IcpRecord = {
    domain: (info.domain as string) ?? query,
    icp: (info.icp as string) ?? '',
    nature: (info.nature as string) ?? '',
    unitName: (info.unitName ?? info.name) as string ?? '',
    updateTime: (info.updateTime ?? info.time) as string ?? '',
  };

  return {
    source: 'icp',
    query,
    total: icpRecord.icp ? 1 : 0,
    results: icpRecord.icp ? [icpRecord] : [],
  };
}

function mapBackupResponse(
  query: string,
  data: Record<string, unknown>
): IntelligenceRecord {
  const icpRecord: IcpRecord = {
    domain: (data.domain as string) ?? query,
    icp: (data.icp as string) ?? '',
    nature: (data.nature as string) ?? '',
    unitName: (data.unitName ?? data.name) as string ?? '',
    updateTime: (data.updateTime ?? data.time) as string ?? '',
  };

  return {
    source: 'icp',
    query,
    total: icpRecord.icp ? 1 : 0,
    results: icpRecord.icp ? [icpRecord] : [],
  };
}
