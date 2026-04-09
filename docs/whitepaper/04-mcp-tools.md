# 04 — MCP 工具体系

> GoPwn 通过 Model Context Protocol（MCP）将 LLM 的推理能力与真实安全工具连接。13 个 MCP Server 提供 38 个工具，覆盖渗透测试全生命周期。

---

## 4.1 MCP 协议概述

MCP（Model Context Protocol）是 Anthropic 提出的开放协议，用于标准化 LLM 与外部工具的通信。GoPwn 使用 `@modelcontextprotocol/sdk`（v1.28）实现 MCP 客户端，通过 **stdio** 传输方式与各 MCP Server 通信。

### 通信流程

```
react-worker (LLM 决策)
    │
    │ function call: { name: "httpx_probe", arguments: { target: "..." } }
    │
    ▼
tool-input-mapper (参数映射)
    │
    │ MCP tool input: { name: "httpx_probe", arguments: { target: "..." } }
    │
    ▼
stdio-connector (JSON-RPC over stdio)
    │
    │ stdin: {"jsonrpc":"2.0","method":"tools/call","params":{...}}
    │ stdout: {"jsonrpc":"2.0","result":{"content":[...]}}
    │
    ▼
MCP Server (独立子进程)
    │
    │ 执行实际操作（HTTP 请求、端口扫描、代码执行等）
    │
    ▼
返回结构化结果 → 注入 LLM 上下文
```

### stdio 连接器特点

- 每个 MCP Server 作为独立子进程运行，通过 stdin/stdout 进行 JSON-RPC 通信
- 子进程在 Worker 启动时根据 `mcps/mcp-servers.json` 清单自动启动
- RPC 超时时 SIGKILL 强杀子进程，防止僵尸进程
- Worker 退出时调用 `closeAll()` 清理所有子进程

## 4.2 完整工具清单

### 4.2.1 DNS / 子域 / 证书

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **subfinder** | `subfinder_enum` | dns_subdomain | 被动子域名枚举 |
| | `subfinder_verify` | dns_subdomain | 子域名枚举 + DNS 验证 |
| **whois** | `whois_query` | dns_whois | 域名 WHOIS 查询 |
| | `whois_ip` | dns_whois | IP WHOIS 查询 |
| | `icp_query` | dns_whois | ICP 备案查询 |

### 4.2.2 主机发现 / 端口扫描

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **fscan** (v2.0) | `fscan_host_discovery` | host_discovery | 主机存活探测 |
| | `fscan_port_scan` | port_scan | 端口扫描 + 服务识别 |
| | `fscan_service_bruteforce` | credential_test | 服务弱口令爆破 |
| | `fscan_vuln_scan` | vuln_scan | 已知漏洞扫描 (MS17-010 等) |
| | `fscan_web_scan` | vuln_scan | Web POC 扫描 |
| | `fscan_full_scan` | port_scan | 综合扫描 |

### 4.2.3 Web 探测 / WAF 检测

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **httpx** | `httpx_probe` | host_discovery | Web 存活探测 |
| | `httpx_tech_detect` | fingerprint | 技术栈识别 |
| **wafw00f** | `wafw00f_detect` | waf_detection | WAF 检测 |
| | `wafw00f_list` | waf_detection | WAF 指纹列表 |

### 4.2.4 HTTP 交互 / 目录发现

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **curl** | `http_request` | http_interaction | 自定义 HTTP 请求 |
| | `http_raw_request` | http_interaction | 原始 TCP 发送 HTTP 包 |
| | `http_batch` | http_interaction | 批量 HTTP 请求 |
| **dirsearch** | `dirsearch_scan` | web_crawl | 目录/文件扫描 |
| | `dirsearch_recursive` | web_crawl | 递归目录扫描 |

### 4.2.5 TCP / 网络交互

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **netcat** | `tcp_connect` | tcp_interaction | TCP 连接 + 数据收发 |
| | `udp_send` | tcp_interaction | UDP 发送 |
| | `tcp_banner_grab` | tcp_interaction | TCP Banner 抓取 |

### 4.2.6 漏洞扫描

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **afrog** | `afrog_scan` | vuln_scan | POC 漏洞扫描 |
| | `afrog_list_pocs` | vuln_scan | 列出可用 POC |

### 4.2.7 情报收集

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **fofa** | `fofa_search` | external_intel | FOFA 资产搜索 |
| | `fofa_host` | external_intel | FOFA 主机详情 |
| | `fofa_stats` | external_intel | FOFA 统计 |
| **github-recon** | `github_code_search` | external_intel | GitHub 代码泄露搜索 |
| | `github_repo_search` | external_intel | GitHub 仓库搜索 |
| | `github_commit_search` | external_intel | GitHub 提交搜索 |

### 4.2.8 编解码 / 密码学

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **encode** | `encode_decode` | crypto_tool | 编解码 (base64/hex/URL 等) |
| | `hash_compute` | crypto_tool | 哈希计算 |
| | `crypto_util` | crypto_tool | 加解密 + JWT 解析 |

### 4.2.9 自主脚本执行

| Server | 工具名 | 能力族 | 说明 |
|--------|--------|--------|------|
| **script** | `execute_code` | code_execution | 执行 Node.js 代码 |
| | `execute_command` | code_execution | 执行 shell 命令 |
| | `read_file` | file_io | 读取文件 |
| | `write_file` | file_io | 写入文件 |

`execute_code` 是最强大的工具 — 当现有工具无法满足需求时，LLM 可以自主编写 Node.js 代码执行任意操作（如自定义 Redis 客户端、MongoDB 连接脚本、CSRF token 处理等）。

## 4.3 能力族分类

每个 MCP 工具在注册时自动推断其所属的能力族（capability），用于在 ReAct 循环中帮助 LLM 选择合适的工具：

| 能力族 | 说明 | 对应工具举例 |
|--------|------|-------------|
| `dns_subdomain` | DNS 和子域名相关 | subfinder_enum |
| `dns_whois` | WHOIS 和 ICP 查询 | whois_query, icp_query |
| `host_discovery` | 主机存活探测 | fscan_host_discovery, httpx_probe |
| `port_scan` | 端口扫描 | fscan_port_scan, fscan_full_scan |
| `web_crawl` | Web 目录和页面发现 | dirsearch_scan |
| `fingerprint` | 技术栈指纹识别 | httpx_tech_detect |
| `waf_detection` | WAF 检测 | wafw00f_detect |
| `http_interaction` | HTTP 请求交互 | http_request, http_raw_request |
| `tcp_interaction` | TCP/UDP 交互 | tcp_connect, tcp_banner_grab |
| `vuln_scan` | 漏洞扫描 | afrog_scan, fscan_vuln_scan |
| `credential_test` | 弱口令和凭据测试 | fscan_service_bruteforce |
| `external_intel` | 外部情报收集 | fofa_search, github_code_search |
| `crypto_tool` | 编解码和密码学 | encode_decode, hash_compute |
| `code_execution` | 代码执行 | execute_code, execute_command |
| `file_io` | 文件读写 | read_file, write_file |

## 4.4 工具注册与自动发现

### 注册流程

```
mcps/mcp-servers.json（Server 清单）
    │
    ▼
mcp-bootstrap.ts: loadServersFromManifest()
    │ 读取清单，将每个 server 配置写入 McpServer 表
    ▼
mcp-bootstrap.ts: syncToolsFromServers()
    │ 对每个启用的 server，通过 stdio 发送 tools/list 请求
    │ 获取工具列表和 inputSchema
    ▼
registry.ts: inferCapability()
    │ 根据工具名和描述自动推断能力族
    ▼
McpTool 表（工具注册完成）
```

### mcp-servers.json 配置示例

```json
{
  "mcpServers": {
    "fscan": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "mcps/fscan-mcp-server",
      "env": {
        "FSCAN_PATH": "mcps/fscan-mcp-server/bin/fscan.exe"
      }
    }
  }
}
```

每个 Server 配置：
- `command` + `args`：启动命令（通常是 `npx tsx src/index.ts`）
- `cwd`：工作目录
- `env`：环境变量（如外部二进制工具路径）

### 新增 MCP 工具

新增工具只需三步：
1. 在 `mcps/` 下创建新的 MCP Server 目录
2. 在 `mcps/mcp-servers.json` 中添加 Server 配置
3. 重启 Worker 或调用 `POST /api/settings/mcp/sync`

工具自动发现、注册、归类，下次 ReAct 循环时自动可用。无需手动编写 Function Calling schema — 工具的 `inputSchema`（JSON Schema）自动映射为 OpenAI functions 格式。

## 4.5 Function Calling 集成

### MCP → OpenAI 转换

`function-calling.ts` 中的 `mcpToolsToFunctions()` 将 MCP 工具自动转换为 OpenAI Function Calling 格式：

```
McpTool                         OpenAI Function
├── toolName: "httpx_probe"  →  name: "httpx_probe"
├── description: "Web 探测"  →  description: "Web 探测"
└── inputSchema: {           →  parameters: {
      type: "object",              type: "object",
      properties: {                properties: {
        target: { type: "string" }   target: { type: "string" }
      },                           },
      required: ["target"]         required: ["target"]
    }                            }
```

### 参数映射

LLM 返回的 function call 参数通过 `tool-input-mapper.ts` 映射为 MCP 工具输入：

- **目标注入**：如果 LLM 未指定 target，自动注入项目的默认目标
- **参数标准化**：不同工具的参数格式不同，统一转换
- **rawRequest 构造**：对 `execute_code` / `execute_command` 等工具，自动构建 `rawRequest` 字段用于日志记录

### 工具参数提示

ReAct 系统提示词中自动包含每个工具的参数提示信息（从 inputSchema 提取）：
- 必填参数和可选参数
- 枚举值列表
- 参数描述
- 默认值说明

这帮助 LLM 更准确地构造工具调用参数。

## 4.6 Scope 策略

每次 MCP 工具调用前，平台检查目标是否在授权范围内：

```typescript
const policy = createScopePolicy(projectTargets)
// 域名目标 → 同根域名均在 scope 内
// IP 目标 → 同 /24 子网均在 scope 内
```

超出 scope 的工具调用不执行，但会将失败原因写入 LLM 上下文：
```
"target 192.168.2.1 is out of scope. 
 Allowed targets: 192.168.1.0/24"
```

LLM 收到这个反馈后，通常会调整目标或跳过该测试。

## 4.7 MCP Server 开发规范

每个 MCP Server 是一个独立的 Node.js 项目，遵循以下规范：

```
mcps/xxx-mcp-server/
├── src/
│   └── index.ts        MCP Server 入口
├── bin/                 外部二进制工具（如 fscan.exe、httpx.exe）
├── package.json         独立的依赖声明
└── tsconfig.json
```

### 开发要点

1. 使用 `@modelcontextprotocol/sdk` 的 `Server` 类实现
2. 实现 `tools/list` 和 `tools/call` 两个 RPC 方法
3. `inputSchema` 使用标准 JSON Schema 描述参数
4. 输出通过 `content` 数组返回，支持 `text` 和 `image` 类型
5. 错误通过 `isError: true` 标记，平台自动处理
6. 二进制工具路径通过环境变量配置，启动时自动解析为绝对路径
