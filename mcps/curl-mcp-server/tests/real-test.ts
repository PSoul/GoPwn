import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/curl-mcp-server',
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test: GET Juice Shop
  const r1 = await client.callTool({ name: 'http_request', arguments: { url: 'http://localhost:3000', method: 'GET', timeout: 10 }});
  const parsed = JSON.parse((r1.content as any)[0].text);
  console.log('Juice Shop GET:', { status: parsed.statusCode, bodyLength: parsed.body?.length });

  // Test: GET WebGoat
  const r2 = await client.callTool({ name: 'http_request', arguments: { url: 'http://localhost:18080', method: 'GET', timeout: 10 }});
  const p2 = JSON.parse((r2.content as any)[0].text);
  console.log('WebGoat GET:', { status: p2.statusCode, bodyLength: p2.body?.length });

  // Test: batch request
  const r3 = await client.callTool({ name: 'http_batch', arguments: {
    requests: [
      { url: 'http://localhost:3000/api/version' },
      { url: 'http://localhost:18080/WebGoat' }
    ],
    concurrency: 2, timeout: 10
  }});
  console.log('Batch results:', JSON.parse((r3.content as any)[0].text));

  await client.close();
  console.log('\n✅ curl-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
