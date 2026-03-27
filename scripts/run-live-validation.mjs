import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import { buildLiveValidationArtifactBundle } from "./lib/live-validation-report.mjs"
import {
  buildLiveValidationServerEnv,
  ensureLiveValidationProject,
  ensureWebSurfaceMcpRegistration,
  getLiveValidationLabDefinition,
  resolveLiveValidationPrototypeDataDir,
} from "./lib/live-validation-runner.mjs"

const LOGIN_ACCOUNT = "researcher@company.local"
const LOGIN_PASSWORD = "Prototype@2026"
const LOGIN_CAPTCHA = "7K2Q"
const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 3301
const DEFAULT_LAB_ID = "juice-shop"
const DEFAULT_APPROVAL_SCENARIO = "include-high-risk"

function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[:.]/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "run"
}

function getNpmCommand() {
  return "npm"
}

function getTaskKillCommand() {
  return process.platform === "win32" ? "taskkill.exe" : "kill"
}

function getLabHealthUrl(labId) {
  if (labId === "webgoat") {
    return "http://127.0.0.1:8080/WebGoat"
  }

  return "http://127.0.0.1:3000"
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code}.${stderr ? `\n${stderr.trim()}` : ""}`,
        ),
      )
    })
  })
}

async function waitForHttp(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000
  const intervalMs = options.intervalMs ?? 2000
  const deadline = Date.now() + timeoutMs
  let lastError = "No response received."

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
      })

      if (response.status < 500) {
        return response
      }

      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timed out waiting for ${url}. Last error: ${lastError}`)
}

function startNextServer({ cwd, host, port, env, logPath }) {
  const logStream = createWriteStream(logPath, { flags: "a" })
  const child = spawn(getNpmCommand(), ["run", "dev", "--", "--hostname", host, "--port", String(port)], {
    cwd,
    env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.pipe(logStream)
  child.stderr.pipe(logStream)

  child.on("error", (error) => {
    logStream.write(`\n[start-error] ${error instanceof Error ? error.message : String(error)}\n`)
  })

  return {
    child,
    logStream,
  }
}

async function stopChildProcess(child) {
  if (!child?.pid) {
    return
  }

  if (process.platform === "win32") {
    try {
      await runCommand(getTaskKillCommand(), ["/pid", String(child.pid), "/t", "/f"])
    } catch {
      // best effort cleanup
    }

    return
  }

  child.kill("SIGTERM")
}

function extractSessionCookie(response) {
  const cookieList =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : []
  const sessionCookie = cookieList.find((cookie) => cookie?.startsWith("prototype_session="))

  if (!sessionCookie) {
    throw new Error("Login response did not include a prototype_session cookie.")
  }

  return sessionCookie.split(";")[0]
}

async function requestJson(url, { method = "GET", body, cookie } = {}) {
  const headers = {
    accept: "application/json",
  }

  if (body) {
    headers["content-type"] = "application/json"
  }

  if (cookie) {
    headers.cookie = cookie
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`Request ${method} ${url} failed with status ${response.status}: ${text}`)
  }

  return {
    response,
    payload,
  }
}

async function login(baseUrl) {
  const { response, payload } = await requestJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: {
      account: LOGIN_ACCOUNT,
      password: LOGIN_PASSWORD,
      captcha: LOGIN_CAPTCHA,
      redirectTo: "/dashboard",
    },
  })

  return {
    payload,
    cookie: extractSessionCookie(response),
  }
}

async function main() {
  const cwd = process.cwd()
  const startedAt = new Date().toISOString()
  const host = process.env.LIVE_VALIDATION_HOST?.trim() || DEFAULT_HOST
  const port = Number(process.env.LIVE_VALIDATION_PORT ?? DEFAULT_PORT)
  const requestedProjectId = process.env.LIVE_VALIDATION_PROJECT_ID?.trim() || ""
  const labId = process.env.LIVE_VALIDATION_LAB_ID?.trim() || DEFAULT_LAB_ID
  const approvalScenario =
    process.env.LIVE_VALIDATION_APPROVAL_SCENARIO?.trim() || DEFAULT_APPROVAL_SCENARIO
  const startLabs = process.env.LIVE_VALIDATION_START_LABS !== "0"
  const autoApprove = process.env.LIVE_VALIDATION_AUTO_APPROVE !== "0"
  const stopLabs = process.env.LIVE_VALIDATION_STOP_LABS === "1"
  const stateMode = process.env.LIVE_VALIDATION_STATE_MODE?.trim() === "workspace" ? "workspace" : "isolated"
  const runDirectoryName = `${sanitizeSegment(startedAt)}-${sanitizeSegment(labId)}`
  const outputRoot = path.join(cwd, "output", "live-validation")
  const runOutputDir = path.join(outputRoot, runDirectoryName)
  const prototypeDataDir = resolveLiveValidationPrototypeDataDir({
    cwd,
    explicitStateDir: process.env.LIVE_VALIDATION_STATE_DIR,
    runDirectoryName,
    stateMode,
  })
  const nextLogPath = path.join(runOutputDir, "next-server.log")
  const baseUrl = `http://${host}:${port}`
  const composeFile = path.join(cwd, "docker", "local-labs", "compose.yaml")
  const lab = getLiveValidationLabDefinition(labId)
  let nextServer = null
  let nextLogStream = null

  await mkdir(runOutputDir, { recursive: true })

  if (prototypeDataDir) {
    await mkdir(prototypeDataDir, { recursive: true })
  }

  try {
    getRequiredEnv("LLM_API_KEY")
    getRequiredEnv("LLM_BASE_URL")
    getRequiredEnv("LLM_ORCHESTRATOR_MODEL")

    if (!lab) {
      throw new Error(`Unknown live validation lab id: ${labId}`)
    }

    if (startLabs) {
      await runCommand("docker", ["compose", "-f", composeFile, "up", "-d"], {
        cwd,
        env: process.env,
      })
      await waitForHttp(getLabHealthUrl(labId), { timeoutMs: 240000, intervalMs: 3000 })
    }

    const serverRuntime = startNextServer({
      cwd,
      host,
      port,
      env: buildLiveValidationServerEnv({
        baseEnv: process.env,
        prototypeDataDir,
      }),
      logPath: nextLogPath,
    })

    nextServer = serverRuntime.child
    nextLogStream = serverRuntime.logStream

    await waitForHttp(`${baseUrl}/login`, { timeoutMs: 180000, intervalMs: 2000 })

    const loginResult = await login(baseUrl)
    const cookie = loginResult.cookie
    const registrationResult = await ensureWebSurfaceMcpRegistration({
      baseUrl,
      cookie,
      requestJson,
    })
    const projectResolution = await ensureLiveValidationProject({
      baseUrl,
      cookie,
      lab,
      requestedProjectId,
      requestJson,
      startedAt,
    })
    const projectId = projectResolution.projectId

    const planResult = await requestJson(`${baseUrl}/api/projects/${projectId}/orchestrator/plan`, {
      method: "POST",
      cookie,
      body: {
        labId,
        approvalScenario,
      },
    })
    const validationResult = await requestJson(`${baseUrl}/api/projects/${projectId}/orchestrator/local-validation`, {
      method: "POST",
      cookie,
      body: {
        labId,
        approvalScenario,
      },
    })

    if (!validationResult.payload.provider?.enabled) {
      throw new Error("Validation path did not use an enabled real LLM provider.")
    }

    let approvalDecision = null

    if (validationResult.payload.status === "waiting_approval" && validationResult.payload.approval && autoApprove) {
      approvalDecision = (
        await requestJson(`${baseUrl}/api/approvals/${validationResult.payload.approval.id}`, {
          method: "PATCH",
          cookie,
          body: {
            decision: "已批准",
          },
        })
      ).payload
    }

    const [contextResult, operationsResult, mcpSettingsResult, mcpRunsResult] = await Promise.all([
      requestJson(`${baseUrl}/api/projects/${projectId}/context`, { cookie }),
      requestJson(`${baseUrl}/api/projects/${projectId}/operations`, { cookie }),
      requestJson(`${baseUrl}/api/settings/mcp-tools`, { cookie }),
      requestJson(`${baseUrl}/api/projects/${projectId}/mcp-runs`, { cookie }),
    ])

    const realRuns = (mcpRunsResult.payload.items ?? []).filter((run) => run.connectorMode === "real")

    if (realRuns.length === 0) {
      throw new Error("No real MCP-backed run was observed in the validation result.")
    }

    const bundle = buildLiveValidationArtifactBundle({
      startedAt,
      finishedAt: new Date().toISOString(),
      project: {
        id: contextResult.payload.project.id,
        name: contextResult.payload.project.name,
      },
      lab: {
        id: validationResult.payload.localLab.id,
        name: validationResult.payload.localLab.name,
        baseUrl: validationResult.payload.localLab.baseUrl,
      },
      provider: {
        provider: validationResult.payload.provider.provider,
        enabled: validationResult.payload.provider.enabled,
        baseUrl: validationResult.payload.provider.baseUrl,
        orchestratorModel: validationResult.payload.provider.orchestratorModel,
      },
      validation: {
        status: approvalDecision ? "approval_resumed" : validationResult.payload.status,
        planSummary: planResult.payload.plan.summary,
        planItems: planResult.payload.plan.items,
        runs: mcpRunsResult.payload.items,
        approval: approvalDecision
          ? {
              id: approvalDecision.id,
              status: approvalDecision.status,
              actionType: approvalDecision.actionType,
            }
          : validationResult.payload.approval
            ? {
                id: validationResult.payload.approval.id,
                status: validationResult.payload.approval.status,
                actionType: validationResult.payload.approval.actionType,
              }
            : null,
      },
      context: {
        assetCount: contextResult.payload.assets.length,
        evidenceCount: contextResult.payload.evidence.length,
        findingCount: contextResult.payload.detail.findings.length,
      },
      mcp: {
        serverCount: mcpSettingsResult.payload.servers.length,
        invocationCount: mcpSettingsResult.payload.recentInvocations.length,
        invocations: mcpSettingsResult.payload.recentInvocations.map((item) => ({
          serverName:
            mcpSettingsResult.payload.servers.find((server) => server.id === item.serverId)?.serverName ?? item.serverId,
          toolName: item.toolName,
          status: item.status,
          target: item.target,
        })),
      },
    })

    const reportPayload = {
      summary: bundle.summary,
      login: loginResult.payload.user,
      registration: registrationResult,
      projectResolution,
      plan: planResult.payload,
      validation: validationResult.payload,
      approvalDecision,
      context: contextResult.payload,
      operations: operationsResult.payload,
      mcpRuns: mcpRunsResult.payload,
      mcpSettings: mcpSettingsResult.payload,
    }

    await writeFile(path.join(runOutputDir, "report.md"), `${bundle.markdown}\n`, "utf8")
    await writeFile(path.join(runOutputDir, "report.json"), `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8")

    console.log(`Live validation completed.`)
    console.log(`Artifact directory: ${runOutputDir}`)
    console.log(`Report: ${path.join(runOutputDir, "report.md")}`)
    console.log(`Project: ${projectId} (${projectResolution.projectName})`)
    console.log(`MCP server: ${registrationResult.serverName} (${registrationResult.registered ? "registered" : "reused"})`)
    console.log(`State dir: ${prototypeDataDir ?? path.join(cwd, ".prototype-store")}`)
  } catch (error) {
    const failurePayload = {
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      logPath: nextLogPath,
    }

    await writeFile(path.join(runOutputDir, "failure.json"), `${JSON.stringify(failurePayload, null, 2)}\n`, "utf8")
    console.error(failurePayload.error)
    console.error(`Failure artifact: ${path.join(runOutputDir, "failure.json")}`)
    process.exitCode = 1
  } finally {
    await stopChildProcess(nextServer)

    if (nextLogStream) {
      nextLogStream.end()
    }

    if (stopLabs && startLabs) {
      try {
        await runCommand("docker", ["compose", "-f", composeFile, "down"], {
          cwd,
          env: process.env,
        })
      } catch {
        // best effort cleanup
      }
    }
  }
}

await main()
