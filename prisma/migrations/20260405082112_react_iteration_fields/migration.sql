-- AlterTable
ALTER TABLE "mcp_runs" ADD COLUMN     "functionArgs" JSONB,
ADD COLUMN     "stepIndex" INTEGER,
ADD COLUMN     "thought" TEXT;

-- AlterTable
ALTER TABLE "orchestrator_rounds" ADD COLUMN     "actualSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxSteps" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "stopReason" TEXT;
