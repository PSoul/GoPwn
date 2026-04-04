-- CreateEnum
CREATE TYPE "ProjectLifecycle" AS ENUM ('idle', 'planning', 'executing', 'waiting_approval', 'reviewing', 'settling', 'stopping', 'stopped', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PentestPhase" AS ENUM ('recon', 'discovery', 'assessment', 'verification', 'reporting');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('domain', 'subdomain', 'ip', 'port', 'service', 'webapp', 'api_endpoint');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('suspected', 'verifying', 'verified', 'false_positive', 'remediated');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'deferred');

-- CreateEnum
CREATE TYPE "McpRunStatus" AS ENUM ('pending', 'scheduled', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('streaming', 'completed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'researcher',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lifecycle" "ProjectLifecycle" NOT NULL DEFAULT 'idle',
    "currentPhase" "PentestPhase" NOT NULL DEFAULT 'recon',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fingerprints" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "mcpRunId" TEXT,
    "title" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "rawOutput" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "artifactPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capturedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "evidenceId" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'suspected',
    "severity" "Severity" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "affectedTarget" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pocs" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "mcpRunId" TEXT,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "executionOutput" TEXT NOT NULL DEFAULT '',
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "toolId" TEXT,
    "capability" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "status" "McpRunStatus" NOT NULL DEFAULT 'pending',
    "phase" "PentestPhase" NOT NULL,
    "round" INTEGER NOT NULL,
    "pgBossJobId" TEXT,
    "rawOutput" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tools" (
    "id" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "boundary" TEXT NOT NULL DEFAULT 'external',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'medium',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER NOT NULL DEFAULT 60000,

    CONSTRAINT "mcp_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cwd" TEXT,
    "envJson" TEXT,
    "endpoint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mcpRunId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestrator_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "phase" "PentestPhase" NOT NULL,
    "provider" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orchestrator_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestrator_rounds" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "phase" "PentestPhase" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "planItemCount" INTEGER NOT NULL DEFAULT 0,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "newAssetCount" INTEGER NOT NULL DEFAULT 0,
    "newFindingCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "orchestrator_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '',
    "status" "LlmCallStatus" NOT NULL DEFAULT 'streaming',
    "model" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_profiles" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "timeoutMs" INTEGER NOT NULL DEFAULT 120000,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,

    CONSTRAINT "llm_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_config" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "approvalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveLowRisk" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveMediumRisk" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "round" INTEGER,
    "jobType" TEXT NOT NULL,
    "jobId" TEXT,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_account_key" ON "users"("account");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "targets_projectId_type_normalized_key" ON "targets"("projectId", "type", "normalized");

-- CreateIndex
CREATE INDEX "assets_projectId_kind_idx" ON "assets"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "assets_projectId_kind_value_key" ON "assets"("projectId", "kind", "value");

-- CreateIndex
CREATE INDEX "fingerprints_assetId_idx" ON "fingerprints"("assetId");

-- CreateIndex
CREATE INDEX "evidence_projectId_idx" ON "evidence"("projectId");

-- CreateIndex
CREATE INDEX "findings_projectId_status_idx" ON "findings"("projectId", "status");

-- CreateIndex
CREATE INDEX "findings_projectId_severity_idx" ON "findings"("projectId", "severity");

-- CreateIndex
CREATE INDEX "pocs_findingId_idx" ON "pocs"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_runs_pgBossJobId_key" ON "mcp_runs"("pgBossJobId");

-- CreateIndex
CREATE INDEX "mcp_runs_projectId_status_idx" ON "mcp_runs"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tools_toolName_key" ON "mcp_tools"("toolName");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_servers_serverName_key" ON "mcp_servers"("serverName");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_mcpRunId_key" ON "approvals"("mcpRunId");

-- CreateIndex
CREATE INDEX "approvals_projectId_status_idx" ON "approvals"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orchestrator_plans_projectId_round_key" ON "orchestrator_plans"("projectId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "orchestrator_rounds_projectId_round_key" ON "orchestrator_rounds"("projectId", "round");

-- CreateIndex
CREATE INDEX "llm_call_logs_projectId_status_idx" ON "llm_call_logs"("projectId", "status");

-- CreateIndex
CREATE INDEX "audit_events_projectId_idx" ON "audit_events"("projectId");

-- CreateIndex
CREATE INDEX "pipeline_logs_projectId_createdAt_idx" ON "pipeline_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "pipeline_logs_projectId_round_idx" ON "pipeline_logs"("projectId", "round");

-- CreateIndex
CREATE INDEX "pipeline_logs_level_idx" ON "pipeline_logs"("level");

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_mcpRunId_fkey" FOREIGN KEY ("mcpRunId") REFERENCES "mcp_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pocs" ADD CONSTRAINT "pocs_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pocs" ADD CONSTRAINT "pocs_mcpRunId_fkey" FOREIGN KEY ("mcpRunId") REFERENCES "mcp_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_runs" ADD CONSTRAINT "mcp_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_runs" ADD CONSTRAINT "mcp_runs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "mcp_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_mcpRunId_fkey" FOREIGN KEY ("mcpRunId") REFERENCES "mcp_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchestrator_plans" ADD CONSTRAINT "orchestrator_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchestrator_rounds" ADD CONSTRAINT "orchestrator_rounds_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_logs" ADD CONSTRAINT "pipeline_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
