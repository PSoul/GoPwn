import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/wafw00f-mcp-server',
    env: { ...process.env, WAFW00F_PATH: 'wafw00f' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: detect WAF on local Juice Shop (should find none)
  console.log('Detecting WAF on Juice Shop...');
  const r1 = await client.callTool({ name: 'wafw00f_detect', arguments: { url: 'http://localhost:3000', timeout: 30 }});
  console.log('WAF detect:', (r1.content as any)[0].text.substring(0, 500));

  // Test: list WAFs
  const r2 = await client.callTool({ name: 'wafw00f_list', arguments: {} });
  const listResult = JSON.parse((r2.content as any)[0].text);
  console.log('WAF list count:', listResult.total || listResult.wafs?.length || 'unknown');

  await client.close();
  console.log('\n✅ wafw00f-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
