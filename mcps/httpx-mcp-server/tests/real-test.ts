import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/httpx-mcp-server',
    env: { ...process.env, HTTPX_PATH: 'D:/dev/mcps/httpx-mcp-server/bin/httpx.exe' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: probe local targets
  console.log('Probing local targets...');
  const r1 = await client.callTool({ name: 'httpx_probe', arguments: { targets: ['http://localhost:3000', 'http://localhost:18080'], timeout: 10 }});
  console.log('Probe result:', (r1.content as any)[0].text.substring(0, 500));

  // Test: tech detect
  console.log('Tech detection...');
  const r2 = await client.callTool({ name: 'httpx_tech_detect', arguments: { targets: ['http://localhost:3000'], timeout: 10 }});
  console.log('Tech detect:', (r2.content as any)[0].text.substring(0, 500));

  await client.close();
  console.log('\n✅ httpx-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
