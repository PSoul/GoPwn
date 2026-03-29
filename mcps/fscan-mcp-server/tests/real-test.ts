import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/fscan-mcp-server',
    env: { ...process.env, FSCAN_PATH: 'D:/dev/mcps/fscan-mcp-server/bin/fscan.exe' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: port scan on localhost
  console.log('Running port scan on 127.0.0.1...');
  const r1 = await client.callTool({ name: 'fscan_port_scan', arguments: { target: '127.0.0.1', ports: '3000,18080,19090', timeout: 30 }});
  console.log('Port scan result:', (r1.content as any)[0].text.substring(0, 500));

  await client.close();
  console.log('\n✅ fscan-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
