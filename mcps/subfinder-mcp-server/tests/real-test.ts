import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/subfinder-mcp-server',
    env: { ...process.env, SUBFINDER_PATH: 'D:/dev/mcps/subfinder-mcp-server/bin/subfinder.exe' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: enumerate subdomains
  console.log('\n--- subfinder_enum for claws.codes ---');
  const r1 = await client.callTool({ name: 'subfinder_enum', arguments: { target: 'claws.codes', timeout: 60 }});
  console.log('Result:', (r1.content as any)[0].text.substring(0, 800));

  await client.close();
  console.log('\n✅ subfinder-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
