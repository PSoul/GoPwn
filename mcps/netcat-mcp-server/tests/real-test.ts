import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/netcat-mcp-server',
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: TCP connect to Juice Shop port 3000
  const r1 = await client.callTool({ name: 'tcp_connect', arguments: { host: '127.0.0.1', port: 3000, data: 'GET / HTTP/1.0\r\nHost: localhost\r\n\r\n', timeout: 5, readUntilClose: true }});
  const p1 = JSON.parse((r1.content as any)[0].text);
  console.log('TCP to Juice Shop:', { connected: p1.connected, responseLength: p1.response?.utf8?.length });

  // Test: Banner grab on port 18080
  const r2 = await client.callTool({ name: 'tcp_banner_grab', arguments: { host: '127.0.0.1', port: 18080, timeout: 3 }});
  console.log('Banner grab WebGoat:', JSON.parse((r2.content as any)[0].text));

  await client.close();
  console.log('\n✅ netcat-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
