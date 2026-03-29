# fscan-mcp-server 代码索引

## 项目概述
MCP Server 包装层，将 fscan 内网扫描工具通过 MCP 协议暴露给 LLM 驱动的渗透测试平台。

## 目录结构

### src/index.ts
MCP Server 入口文件。创建 McpServer 实例（name: `fscan-mcp-server`, version: `1.0.0`），注册 6 个工具，通过 StdioServerTransport 连接。

### src/fscan/locator.ts
**导出:** `locateFscan(): string`
定位 fscan 二进制路径。优先使用 `FSCAN_PATH` 环境变量，回退到系统 PATH 查找（Windows 用 `where`，其他平台用 `which`）。找不到时抛出错误。

### src/fscan/runner.ts
**导出:** `runFscan(options: RunFscanOptions): Promise<ScanResult[]>`
**接口:** `RunFscanOptions { args: string[]; timeoutMs?: number }`
调用 fscan 二进制。创建临时 JSON 输出文件（`os.tmpdir()/fscan-<uuid>.json`），执行 fscan 进程（追加 `-f json -o <tmpFile> -nocolor` 参数），解析结果，清理临时文件。默认超时 300 秒，maxBuffer 50 MB。

### src/parsers/json-parser.ts
**导出:** `parseFscanOutput(raw: string): ScanResult[]`
解析 fscan 的 JSON 输出。优先尝试 JSON 数组格式，回退到 JSONL（每行一个 JSON 对象）格式。空输入返回 `[]`，无法解析任何行时抛出错误。

### src/mappers/types.ts
共享类型定义：
- `ScanResult` — fscan 原始输出类型（`time`, `type`: HOST/PORT/SERVICE/VULN, `target`, `status`, `details`）
- `NetworkRecord` — 端口/服务/指纹记录（`host`, `port`, `protocol`, `service`, `fingerprint?`, `version?`）
- `Finding` — 漏洞/弱密码发现（`host`, `port?`, `type`, `severity`: info/low/medium/high/critical, `title`, `description`, `evidence?`）
- `Asset` — 资产记录（`type: 'ip'`, `address`, `ports?`, `os?`, `alive`）

### src/mappers/network.ts
**导出:** `mapToNetwork(results: ScanResult[]): NetworkRecord[]`
将 PORT/SERVICE 类型结果映射为 NetworkRecord。按 `host:port` 去重，SERVICE 记录覆盖已有的 PORT 记录（补充 service、version、fingerprint）。

### src/mappers/findings.ts
**导出:** `mapToFindings(results: ScanResult[]): Finding[]`
将 VULN 类型结果映射为 Finding。严重性分级：`critical`（MS17-010、DOUBLEPULSAR），`high`（smbghost、weak-password、unauthorized），其余为 `medium`。

### src/mappers/assets.ts
**导出:** `mapToAssets(results: ScanResult[]): Asset[]`
将所有结果聚合为 Asset。按 IP 去重，HOST alive 状态合并，PORT/SERVICE 结果合并为端口列表（SERVICE 更新已有端口的 service 和 fingerprint）。

### src/tools/host-discovery.ts
**工具名:** `fscan_host_discovery`
主机发现。调用 fscan `-m icmp`，支持参数 `target`、`timeout`（默认 3s）、`noPing`（默认 false）。返回 `{ assets, summary }`。

### src/tools/port-scan.ts
**工具名:** `fscan_port_scan`
端口扫描。调用 fscan `-m portscan`，支持参数 `target`、`ports`、`threads`（默认 600）、`timeout`（默认 3s）。返回 `{ network, assets, summary }`。

### src/tools/service-bruteforce.ts
**工具名:** `fscan_service_bruteforce`
服务爆破。支持 23 种服务（ssh/smb/rdp/mysql/mssql/postgres/oracle/mongodb/redis/ftp/imap/pop3/smtp/snmp/ldap/vnc/telnet/elasticsearch/rabbitmq/kafka/activemq/cassandra/neo4j）。支持 `user`、`password`、`userFile`、`passFile`、`port`、`threads`（默认 10）、`timeout`（默认 3s）。返回 `{ findings, summary }`。

### src/tools/vuln-scan.ts
**工具名:** `fscan_vuln_scan`
漏洞扫描。支持 `vulnType` 枚举（`ms17010` | `smbghost`，默认 `ms17010`），`timeout`（默认 3s）。返回 `{ findings, summary }`。

### src/tools/web-scan.ts
**工具名:** `fscan_web_scan`
Web 应用扫描。`target` 和 `url` 至少提供一个（否则返回 isError）。支持 `pocName`、`cookie`、`proxy`、`full`（默认 false）、`timeout`（默认 5s）。返回 `{ findings, summary }`。

### src/tools/full-scan.ts
**工具名:** `fscan_full_scan`
全功能扫描。调用 fscan 默认模式（无 `-m` 参数），支持 `ports`、`threads`（默认 600）、`noBrute`（默认 false）、`noPoc`（默认 false）、`timeout`（默认 3s）。返回 `{ network, findings, assets, summary }`。

## 测试

### tests/unit/locator.test.ts
fscan 路径定位器单元测试（3 个用例）：FSCAN_PATH 环境变量、PATH 回退、找不到时抛出错误。

### tests/unit/json-parser.test.ts
JSON 解析器单元测试（5 个用例）：host-discovery 数组、port-scan 数组、空输入、JSONL 格式、无效 JSON 抛出错误。

### tests/unit/mappers.test.ts
三个映射器单元测试（6 个用例）：mapToNetwork（2）、mapToFindings（2）、mapToAssets（2）。

### tests/e2e/mcp-server.test.ts
MCP 协议级 E2E 测试（8 个用例）。使用 InMemoryTransport + mock runner（vi.mock runner）。覆盖：工具列表验证、6 个工具各一个调用测试、web_scan 无参数错误测试。

### tests/fixtures/
测试夹具目录，包含 6 个 JSON 文件模拟 fscan 输出：`host-discovery.json`、`port-scan.json`、`service-brute.json`、`vuln-scan.json`、`web-scan.json`、`full-scan.json`。

## 配置文件

### package.json
Node.js 项目配置（ESM 模块）。运行时依赖：`@modelcontextprotocol/sdk`、`zod`。开发依赖：`typescript`、`vitest`、`tsx`、`@types/node`。

### tsconfig.json
TypeScript 配置。target: ES2022，module: NodeNext，moduleResolution: NodeNext，strict 模式，输出到 `dist/`。

### vitest.config.ts
Vitest 测试配置。测试文件匹配 `tests/**/*.test.ts`。

### examples/registration.json
符合 llmpentest-mcp-template 协议的服务器注册示例。定义 6 个工具的 capability、resultMappings 和 riskLevel。
