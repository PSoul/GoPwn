Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '研究员',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetInput" TEXT NOT NULL,
    "targets" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT '授权与范围定义',
    "status" TEXT NOT NULL DEFAULT '待处理',
    "pendingApprovals" INTEGER NOT NULL DEFAULT 0,
    "openTasks" INTEGER NOT NULL DEFAULT 0,
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "riskSummary" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "lastActor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_details" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "blockingReason" TEXT NOT NULL DEFAULT '',
    "nextStep" TEXT NOT NULL DEFAULT '',
    "reflowNotice" TEXT NOT NULL DEFAULT '',
    "currentFocus" TEXT NOT NULL DEFAULT '',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "discoveredInfo" JSONB NOT NULL DEFAULT '[]',
    "serviceSurface" JSONB NOT NULL DEFAULT '[]',
    "fingerprints" JSONB NOT NULL DEFAULT '[]',
    "entries" JSONB NOT NULL DEFAULT '[]',
    "scheduler" JSONB NOT NULL DEFAULT '[]',
    "activity" JSONB NOT NULL DEFAULT '[]',
    "resultMetrics" JSONB NOT NULL DEFAULT '[]',
    "assetGroups" JSONB NOT NULL DEFAULT '[]',
    "currentStage" JSONB NOT NULL DEFAULT '{}',
    "approvalControl" JSONB NOT NULL DEFAULT '{}',
    "closureStatus" JSONB NOT NULL DEFAULT '{}',
    "finalConclusion" JSONB,

    CONSTRAINT "project_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_conclusions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "nextActions" TEXT[],
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "findingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_scheduler_controls" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lifecycle" TEXT NOT NULL DEFAULT 'idle',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "autoReplan" BOOLEAN NOT NULL DEFAULT true,
    "maxRounds" INTEGER NOT NULL DEFAULT 3,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_scheduler_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_form_presets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetInput" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "project_form_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "impact" TEXT NOT NULL DEFAULT '',
    "mcpCapability" TEXT NOT NULL DEFAULT '',
    "tool" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '待处理',
    "parameterSummary" TEXT NOT NULL DEFAULT '',
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stopCondition" TEXT NOT NULL DEFAULT '',
    "blockingImpact" TEXT NOT NULL DEFAULT '',
    "queuePosition" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "profile" TEXT NOT NULL DEFAULT '',
    "scopeStatus" TEXT NOT NULL DEFAULT '待确认',
    "lastSeen" TEXT NOT NULL DEFAULT '',
    "host" TEXT NOT NULL DEFAULT '',
    "ownership" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT '',
    "exposure" TEXT NOT NULL DEFAULT '',
    "linkedEvidenceId" TEXT NOT NULL DEFAULT '',
    "linkedTaskTitle" TEXT NOT NULL DEFAULT '',
    "issueLead" TEXT NOT NULL DEFAULT '',
    "relations" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT '',
    "conclusion" TEXT NOT NULL DEFAULT '',
    "linkedApprovalId" TEXT NOT NULL DEFAULT '',
    "rawOutput" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenshotNote" TEXT NOT NULL DEFAULT '',
    "structuredSummary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedTaskTitle" TEXT NOT NULL DEFAULT '',
    "linkedAssetLabel" TEXT NOT NULL DEFAULT '',
    "timeline" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verdict" TEXT NOT NULL DEFAULT '',
    "capturedUrl" TEXT,
    "screenshotArtifactPath" TEXT,
    "htmlArtifactPath" TEXT,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待验证',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "affectedSurface" TEXT NOT NULL DEFAULT '',
    "evidenceId" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "toolId" TEXT NOT NULL DEFAULT '',
    "toolName" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "boundary" TEXT NOT NULL,
    "dispatchMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待审批',
    "requestedBy" TEXT NOT NULL DEFAULT '',
    "connectorMode" TEXT,
    "linkedApprovalId" TEXT,
    "summaryLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_tasks" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "connectorMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "summaryLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastError" TEXT,
    "linkedApprovalId" TEXT,
    "workerId" TEXT,
    "leaseToken" TEXT,
    "leaseStartedAt" TEXT,
    "leaseExpiresAt" TEXT,
    "heartbeatAt" TEXT,
    "recoveryCount" INTEGER,
    "lastRecoveredAt" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduler_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tools" (
    "id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "riskLevel" TEXT NOT NULL DEFAULT '中',
    "status" TEXT NOT NULL DEFAULT '启用',
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "inputMode" TEXT NOT NULL DEFAULT '',
    "outputMode" TEXT NOT NULL DEFAULT '',
    "boundary" TEXT NOT NULL DEFAULT '平台内部处理',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "endpoint" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "defaultConcurrency" TEXT NOT NULL DEFAULT '',
    "rateLimit" TEXT NOT NULL DEFAULT '',
    "timeout" TEXT NOT NULL DEFAULT '',
    "retry" TEXT NOT NULL DEFAULT '',
    "lastCheck" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "mcp_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_server_contracts" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "transport" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "toolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "command" TEXT,
    "endpoint" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_server_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tool_contracts" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "capability" TEXT NOT NULL DEFAULT '',
    "boundary" TEXT NOT NULL DEFAULT '平台内部处理',
    "riskLevel" TEXT NOT NULL DEFAULT '中',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "resultMappings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_tool_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestrator_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "orchestrator_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestrator_rounds" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT NOT NULL DEFAULT '',
    "planItemCount" INTEGER NOT NULL DEFAULT 0,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "newAssetCount" INTEGER NOT NULL DEFAULT 0,
    "newEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "newFindingCount" INTEGER NOT NULL DEFAULT 0,
    "failedActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedByApproval" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summaryForNextRound" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "orchestrator_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_profiles" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "label" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "llm_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_approval_control" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT '高风险需审批',
    "autoApproveLowRisk" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "global_approval_control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_rules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "scope_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "projectName" TEXT,
    "actor" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_logs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "projectName" TEXT,
    "actor" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_account_key" ON "users"("account");

-- CreateIndex
CREATE UNIQUE INDEX "project_details_projectId_key" ON "project_details"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_conclusions_projectId_key" ON "project_conclusions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_scheduler_controls_projectId_key" ON "project_scheduler_controls"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_form_presets_projectId_key" ON "project_form_presets"("projectId");

-- CreateIndex
CREATE INDEX "approvals_projectId_idx" ON "approvals"("projectId");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "evidence_projectId_idx" ON "evidence"("projectId");

-- CreateIndex
CREATE INDEX "findings_projectId_idx" ON "findings"("projectId");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "mcp_runs_projectId_idx" ON "mcp_runs"("projectId");

-- CreateIndex
CREATE INDEX "mcp_runs_status_idx" ON "mcp_runs"("status");

-- CreateIndex
CREATE INDEX "scheduler_tasks_projectId_idx" ON "scheduler_tasks"("projectId");

-- CreateIndex
CREATE INDEX "scheduler_tasks_status_idx" ON "scheduler_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orchestrator_plans_projectId_key" ON "orchestrator_plans"("projectId");

-- CreateIndex
CREATE INDEX "orchestrator_rounds_projectId_idx" ON "orchestrator_rounds"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "orchestrator_rounds_projectId_round_key" ON "orchestrator_rounds"("projectId", "round");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX "work_logs_category_idx" ON "work_logs"("category");

-- AddForeignKey
ALTER TABLE "project_details" ADD CONSTRAINT "project_details_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_conclusions" ADD CONSTRAINT "project_conclusions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_scheduler_controls" ADD CONSTRAINT "project_scheduler_controls_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_form_presets" ADD CONSTRAINT "project_form_presets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_runs" ADD CONSTRAINT "mcp_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduler_tasks" ADD CONSTRAINT "scheduler_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

