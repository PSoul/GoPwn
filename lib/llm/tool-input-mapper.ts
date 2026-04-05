/**
 * Tool input mapper — builds MCP tool input from target/action descriptions.
 * Extracted from execution-worker.ts for reuse by the ReAct worker.
 */

const TARGET_PARAM_NAMES = new Set(["target", "targets", "url", "endpoint", "address"])
const HOST_PARAM_NAMES = new Set(["host", "hostname", "domain"])
const ACTION_PARAM_NAMES = new Set(["action", "command", "description"])

type ParsedTarget = { host: string; port: number | null; targets: string[] }

/** Parse a target string into host, port, and array forms */
function parseTarget(target: string): ParsedTarget {
  try {
    const url = new URL(target)
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : null,
      targets: [target],
    }
  } catch {
    // Not a URL
  }

  const match = target.match(/^([^:]+):(\d+)$/)
  if (match) {
    return {
      host: match[1],
      port: parseInt(match[2], 10),
      targets: [target],
    }
  }

  if (target.includes(",")) {
    const parts = target.split(",").map((s) => s.trim()).filter(Boolean)
    return { host: parts[0], port: null, targets: parts }
  }

  return { host: target, port: null, targets: [target] }
}

/** Heuristic: does the string look like executable code rather than natural language? */
export function looksLikeCode(text: string): boolean {
  if (!text || text.length < 10) return false
  const codeSignals = [
    /\brequire\s*\(/, /\bimport\s+/, /\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /\bvar\s+\w+\s*=/,
    /\bfunction\s+\w+/, /=>\s*\{/, /console\.\w+\(/, /\bnew\s+\w+/, /\.\w+\([^)]*\)/,
    /[{}\[\];]/, /\bawait\s+/, /\btry\s*\{/,
  ]
  const matches = codeSignals.filter((r) => r.test(text)).length
  return matches >= 2
}

/** Generate a basic probe script when the LLM gave natural language instead of code */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildFallbackScript(target: string, _action: string): string {
  if (/^tcp:\/\//i.test(target) || (!target.startsWith("http") && /:\d+$/.test(target))) {
    const cleaned = target.replace(/^tcp:\/\//, "")
    const parts = cleaned.split(":")
    const host = parts.slice(0, -1).join(":") || parts[0]
    const port = parts[parts.length - 1] || "80"
    return `
const net = require('net');
const client = new net.Socket();
client.setTimeout(10000);
client.connect(${port}, '${host}', () => {
  setTimeout(() => { try { client.write('\\r\\n'); } catch {} }, 500);
});
let data = Buffer.alloc(0);
client.on('data', (chunk) => {
  data = Buffer.concat([data, chunk]);
  if (data.length > 20) {
    console.log(JSON.stringify({ service: 'unknown', port: ${port}, banner: data.toString('utf8').slice(0, 500) }));
    client.destroy();
  }
});
client.on('timeout', () => { console.log(JSON.stringify({ error: 'timeout', port: ${port} })); client.destroy(); });
client.on('error', (e) => { console.log(JSON.stringify({ error: e.message, port: ${port} })); });
setTimeout(() => { client.destroy(); }, 15000);
`.trim()
  }

  const url = target.startsWith("http") ? target : `http://${target}`
  return `
const http = require('${url.startsWith("https") ? "https" : "http"}');
const req = http.get('${url}', { timeout: 10000 }, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log(JSON.stringify({
      status: res.statusCode,
      headers: res.headers,
      body: body.slice(0, 3000)
    }));
  });
});
req.on('error', (e) => console.log(JSON.stringify({ error: e.message })));
req.on('timeout', () => { req.destroy(); console.log(JSON.stringify({ error: 'timeout' })); });
`.trim()
}

/**
 * Build MCP tool input from the action description and tool schema.
 * Parses the tool's inputSchema to map target/action to expected parameter names and types.
 */
export async function buildToolInput(toolName: string, target: string, action: string): Promise<Record<string, unknown>> {
  const { findByToolName } = await import("@/lib/repositories/mcp-tool-repo")
  const tool = await findByToolName(toolName)
  const schema = (tool?.inputSchema ?? {}) as Record<string, unknown>
  const properties = (schema.properties ?? {}) as Record<string, { type?: string; items?: unknown }>
  const propNames = Object.keys(properties)

  if (propNames.length === 0) {
    return { target, action }
  }

  const input: Record<string, unknown> = {}
  const parsed = parseTarget(target)

  for (const name of propNames) {
    const propSchema = properties[name]
    const propType = propSchema?.type

    if (propType === "array") {
      if (TARGET_PARAM_NAMES.has(name)) {
        input[name] = parsed.targets
      } else if (name === "requests") {
        input[name] = parsed.targets.map((t) => ({
          url: t.startsWith("http") ? t : `http://${t}`,
          method: "GET",
        }))
      }
      continue
    }

    if (TARGET_PARAM_NAMES.has(name)) {
      input[name] = target
    } else if (HOST_PARAM_NAMES.has(name)) {
      input[name] = parsed.host
    } else if (name === "port" || name === "ports") {
      if (parsed.port == null) continue
      input[name] = propType === "number" ? parsed.port : String(parsed.port)
    } else if (name === "rawRequest") {
      if (action && (action.startsWith("GET ") || action.startsWith("POST ") || action.startsWith("HEAD "))) {
        input[name] = action
      } else {
        const parsedUrl = target.startsWith("http") ? new URL(target) : null
        const path = parsedUrl?.pathname ?? "/"
        const host = parsedUrl?.host ?? target
        input[name] = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\n\r\n`
      }
    } else if (ACTION_PARAM_NAMES.has(name)) {
      input[name] = action
    } else if (name === "query") {
      input[name] = action || target
    } else if (name === "code") {
      input[name] = looksLikeCode(action) ? action : buildFallbackScript(target, action)
    } else if (name === "language") {
      input[name] = "javascript"
    }
  }

  return input
}

/**
 * Build MCP tool input from LLM's function call arguments.
 * In ReAct mode, the LLM directly provides structured arguments via function calling.
 * Falls back to buildToolInput() if the LLM arguments are empty/invalid.
 */
export async function buildToolInputFromFunctionArgs(
  toolName: string,
  functionArgs: Record<string, unknown>,
  target: string,
  action: string,
): Promise<Record<string, unknown>> {
  if (functionArgs && Object.keys(functionArgs).length > 0) {
    return functionArgs
  }
  return buildToolInput(toolName, target, action)
}
