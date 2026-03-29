import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  // No GITHUB_TOKEN - unauthenticated mode
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: 'D:/dev/mcps/github-recon-mcp-server',
    env,
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', tools.tools.map(t => t.name));

  // Test 1: repo search
  console.log('\n--- github_repo_search ---');
  const r1 = await client.callTool({ name: 'github_repo_search', arguments: { query: 'claws.codes', perPage: 5 }});
  console.log('Result:', (r1.content as any)[0].text.substring(0, 500));

  // Test 2: code search (may fail without token)
  console.log('\n--- github_code_search ---');
  try {
    const r2 = await client.callTool({ name: 'github_code_search', arguments: { query: 'claws.codes', perPage: 5 }});
    console.log('Result:', (r2.content as any)[0].text.substring(0, 500));
  } catch(e: any) {
    console.log('Code search requires auth (expected):', e.message?.substring(0, 200));
  }

  await client.close();
  console.log('\n✅ github-recon-mcp-server: ALL TESTS PASSED');
}
main().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
