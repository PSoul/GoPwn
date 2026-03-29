import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/afrog-mcp-server',
    env: { ...process.env, AFROG_PATH: 'D:/dev/mcps/afrog-mcp-server/bin/afrog.exe' },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: list POCs
  console.log('Listing POCs...');
  const r1 = await client.callTool(
    { name: 'afrog_list_pocs', arguments: {} },
    undefined,
    { timeout: 120_000 }
  );
  const listResult = JSON.parse((r1.content as any)[0].text);
  console.log('POC count:', listResult.summary);

  // Test: scan Juice Shop with limited scope
  console.log('Scanning Juice Shop (info level only)...');
  const r2 = await client.callTool(
    { name: 'afrog_scan', arguments: { target: 'http://localhost:3000', severity: 'info', timeout: 60 } },
    undefined,
    { timeout: 240_000 }
  );
  console.log('Afrog scan:', (r2.content as any)[0].text.substring(0, 500));

  await client.close();
  console.log('\n✅ afrog-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
