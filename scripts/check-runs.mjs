import 'dotenv/config';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const runs = await prisma.mcpRun.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: {
    toolName: true,
    target: true,
    status: true,
    functionArgs: true,
    rawOutput: true,
    round: true,
    stepIndex: true,
  },
});

for (const r of runs) {
  console.log(`\n[R${r.round} S${r.stepIndex}] ${r.toolName} -> ${r.target} (${r.status})`);
  console.log(`args: ${JSON.stringify(r.functionArgs)}`);
  console.log(`output(500): ${(r.rawOutput || '(empty)').slice(0, 500)}`);
}

await prisma.$disconnect();
