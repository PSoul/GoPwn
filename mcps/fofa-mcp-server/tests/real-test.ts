import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/fofa-mcp-server',
    env: {
      ...process.env,
      FOFA_EMAIL: 'test@test.com',  // try with dummy email first
      FOFA_KEY: '55f3c3a13244c1d22dafe0dac93ebe95'
    },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: search for claws.codes
  console.log('\n--- fofa_search for claws.codes ---');
  const r1 = await client.callTool({ name: 'fofa_search', arguments: { query: 'domain="claws.codes"', size: 10 }});
  console.log('Result:', (r1.content as any)[0].text.substring(0, 800));

  await client.close();
  console.log('\n✅ fofa-mcp-server: TESTS COMPLETED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
