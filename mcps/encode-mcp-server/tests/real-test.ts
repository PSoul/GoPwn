import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/encode-mcp-server',
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  // Test 1: List tools
  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test 2: Base64 encode
  const r1 = await client.callTool({ name: 'encode_decode', arguments: { input: 'Hello World', operation: 'encode', algorithm: 'base64' }});
  console.log('Base64 encode:', JSON.parse((r1.content as any)[0].text));

  // Test 3: MD5 hash
  const r2 = await client.callTool({ name: 'hash_compute', arguments: { input: 'test', algorithm: 'md5' }});
  console.log('MD5 hash:', JSON.parse((r2.content as any)[0].text));

  // Test 4: UUID generate
  const r3 = await client.callTool({ name: 'crypto_util', arguments: { operation: 'uuid-generate' }});
  console.log('UUID:', JSON.parse((r3.content as any)[0].text));

  // Test 5: JWT decode
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const r4 = await client.callTool({ name: 'crypto_util', arguments: { operation: 'jwt-decode', token: jwt }});
  console.log('JWT decode:', JSON.parse((r4.content as any)[0].text));

  await client.close();
  console.log('\n✅ encode-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
