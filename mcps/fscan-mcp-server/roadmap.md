# fscan-mcp-server 开发路线图

## Phase 1: 核心 MCP Server（已完成）

### 目标
构建可用的 MCP Server，包装 fscan 核心扫描能力。

### 任务清单
- [x] 项目脚手架（TypeScript + Vitest）
- [x] fscan 二进制定位器（FSCAN_PATH / PATH）
- [x] JSON 输出解析器（JSON Array + JSONL）
- [x] 结果映射器（network / findings / assets）
- [x] fscan 进程 Runner
- [x] 6 个 MCP Tool Handler
  - [x] fscan_host_discovery — 主机发现
  - [x] fscan_port_scan — 端口扫描
  - [x] fscan_service_bruteforce — 服务爆破
  - [x] fscan_vuln_scan — 漏洞扫描
  - [x] fscan_web_scan — Web 应用扫描
  - [x] fscan_full_scan — 全功能扫描
- [x] MCP Server 入口（stdio transport）
- [x] 单元测试（14 个用例）
- [x] E2E 测试（8 个用例）
- [x] 注册示例文件
- [x] 代码索引和路线图文档

### 验收标准
- TypeScript 编译无错误
- 22 个测试全部通过
- 6 个工具可通过 MCP 协议调用
- 结果符合 llmpentest-mcp-template 的 result mapping 格式

## Phase 2: 增强功能（计划中）

### 目标
增加更多结果映射类型和运行时功能。

### 任务清单
- [ ] 增加 workLogs 结果映射（执行日志）
- [ ] 增加 evidence 结果映射（扫描证据）
- [ ] 支持 fscan 扫描进度回报（MCP progress notification）
- [ ] 支持取消正在运行的扫描（MCP cancellation）
- [ ] 增加 fscan 版本检测和兼容性验证

### 验收标准
- workLogs 和 evidence 映射通过单元测试
- 长时间扫描可以通过 MCP 取消
- 进度信息可实时回报给 Client

## Phase 3: 细粒度工具（计划中）

### 目标
增加更多专用工具，提供更精细的扫描控制。

### 任务清单
- [ ] Redis 利用工具（写 SSH key、cron 反弹）
- [ ] WMI 命令执行工具
- [ ] SSH 远程命令执行工具
- [ ] MS17-010 利用工具（shellcode 注入）
- [ ] 自定义 POC 扫描工具

### 验收标准
- 每个专用工具有独立的 inputSchema
- E2E 测试覆盖所有新工具
- 安全防护机制（操作确认、范围限制）
