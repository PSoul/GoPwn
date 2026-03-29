import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/whois-mcp-server',
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test 1: Domain whois
  console.log('\n--- whois_query for claws.codes ---');
  const r1 = await client.callTool({ name: 'whois_query', arguments: { domain: 'claws.codes', timeout: 15000 }});
  console.log('Result:', (r1.content as any)[0].text.substring(0, 800));

  // Test 2: ICP query
  console.log('\n--- icp_query for claws.codes ---');
  const r2 = await client.callTool({ name: 'icp_query', arguments: { query: 'claws.codes', timeout: 15000 }});
  console.log('Result:', (r2.content as any)[0].text.substring(0, 500));

  await client.close();
  console.log('\n✅ whois-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
