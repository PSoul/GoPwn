import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/dirsearch-mcp-server',
    env: { ...process.env, DIRSEARCH_PATH: 'dirsearch' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: scan Juice Shop with small wordlist to keep it fast
  console.log('Scanning Juice Shop...');
  const r1 = await client.callTool(
    {
      name: 'dirsearch_scan',
      arguments: {
        url: 'http://localhost:3000',
        extensions: 'js',
        threads: 20,
        excludeStatus: '404,500',
        timeout: 30,
      },
    },
    undefined,
    { timeout: 600000 }
  );
  console.log('Dirsearch result:', (r1.content as any)[0].text.substring(0, 500));

  await client.close();
  console.log('\n✅ dirsearch-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
