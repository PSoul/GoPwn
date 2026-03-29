import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runFscan } from '../fscan/runner.js';
import { mapToFindings } from '../mappers/findings.js';

const SERVICES = [
  'ssh', 'smb', 'rdp', 'mysql', 'mssql', 'postgres', 'oracle',
  'mongodb', 'redis', 'ftp', 'imap', 'pop3', 'smtp', 'snmp',
  'ldap', 'vnc', 'telnet', 'elasticsearch', 'rabbitmq', 'kafka',
  'activemq', 'cassandra', 'neo4j',
] as const;

export function registerServiceBruteforce(server: McpServer) {
  server.tool(
    'fscan_service_bruteforce',
    'Brute force credentials for a specific network service (SSH, SMB, MySQL, etc.)',
    {
      target: z.string().describe('Target IP or CIDR range'),
      service: z.enum(SERVICES).describe('Service type to brute force'),
      port: z.number().optional().describe('Port number (defaults to service standard port)'),
      user: z.string().optional().describe('Single username to try'),
      password: z.string().optional().describe('Single password to try'),
      userFile: z.string().optional().describe('Path to username dictionary file'),
      passFile: z.string().optional().describe('Path to password dictionary file'),
      threads: z.number().optional().default(10).describe('Number of concurrent threads'),
      timeout: z.number().optional().default(3).describe('Timeout in seconds'),
    },
    async ({ target, service, port, user, password, userFile, passFile, threads, timeout }) => {
      const args = ['-h', target, '-m', service, '-mt', String(threads), '-time', String(timeout), '-nopoc'];
      if (port) args.push('-p', String(port));
      if (user) args.push('-user', user);
      if (password) args.push('-pwd', password);
      if (userFile) args.push('-userf', userFile);
      if (passFile) args.push('-pwdf', passFile);

      const results = await runFscan({ args, timeoutMs: timeout * 30_000 });
      const findings = mapToFindings(results);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ findings, summary: `Found ${findings.length} credential findings for ${service}` }, null, 2),
          },
        ],
      };
    }
  );
}
