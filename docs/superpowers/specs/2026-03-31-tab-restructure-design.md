# Tab 重构 + 术语清理设计文档

## 背景

debug/0331-6.md 暴露三个核心问题：
1. "域名/Web" Tab 混合了 DNS 层资产和 HTTP 层资产，语义模糊
2. 端口/服务数据在 UI 中不显示（资产提取 → assetGroups 刷新链路断裂）
3. 多处术语对新用户不友好（"已纳入""编排""调度""MCP"等）

## 变更范围

### A. Tab 结构重构

**现有 8 Tab：**
```
概览 | 域名/Web | 端口/服务 | 漏洞 | 上下文 | 阶段 | 调度 | AI 日志
```

**新 7 Tab：**
```
概览 | 域名 | 站点 | 端口 | 漏洞 | 执行控制 | AI 日志
```

| 操作 | 详情 |
|------|------|
| 删除 | "上下文"（内容分散、与其他 Tab 重叠）、"阶段"（信息量低，调度已覆盖） |
| 拆分 | "域名/Web" → "域名" + "站点" |
| 重命名 | "端口/服务" → "端口"，"调度" → "执行控制" |

### B. 各 Tab 表格定义

#### 域名 Tab — DNS 层资产

对应 `asset.type`: `domain`, `subdomain`

| 列名 | 字段来源 | 说明 |
|------|----------|------|
| 域名 | asset.label | FQDN |
| 类型 | asset.type | "主域名" / "子域名" |
| 解析 IP | asset.host | A 记录解析结果 |
| 来源 | asset.ownership | 发现工具名 |
| 状态 | asset.scopeStatus | 已确认 / 待验证 / 需人工判断 |

**空状态：** 当项目目标为纯 IP（无域名资产）时，显示提示：
> "当前目标为 IP 地址，无域名资产。可在端口 Tab 查看网络层探测结果。"

#### 站点 Tab — HTTP 应用层资产

对应 `asset.type`: `entry`, `web`, `api`

| 列名 | 字段来源 | 说明 |
|------|----------|------|
| URL | asset.label | 完整 URL |
| 标题 | asset.profile (提取) | 页面标题 |
| 状态码 | asset.exposure (提取) | HTTP 状态码 |
| 服务器/组件 | asset.profile (提取) | Web Server / 技术栈 |
| 状态 | asset.scopeStatus | 已确认 / 待验证 / 需人工判断 |

**空状态：** "暂未发现 Web 站点。项目启动后，探测工具会自动识别 HTTP 服务。"

#### 端口 Tab — 网络层资产（Nmap 经典模式）

对应 `asset.type`: `host`, `ip`, `port`, `service`

| 列名 | 字段来源 | 说明 |
|------|----------|------|
| IP | asset.host | 主机地址 |
| 端口 | 从 asset.label 解析 | 端口号 |
| 协议 | asset.exposure (提取) | TCP/UDP |
| 服务 | asset.profile (提取) | ssh / http / mongodb 等 |
| 产品/版本 | asset.profile (提取) | 软件名+版本 |
| 状态 | asset.scopeStatus | 已确认 / 待验证 / 需人工判断 |

**空状态：** "暂未发现开放端口。项目启动后，探测工具会自动扫描目标端口。"

### C. 术语清理

#### 资产状态（scopeStatus）

| 现有 | 新值 | 语义 |
|------|------|------|
| 已纳入 | **已确认** | 工具发现且验证存在 |
| 待确认 | **待验证** | 工具发现，尚未验证 |
| 待复核 | **需人工判断** | 自动判断不了，需研究员介入 |

#### 项目状态（project.status）

| 现有 | 新值 | 语义 |
|------|------|------|
| 待处理 | **待启动** | 项目已创建，尚未开始 |
| 已阻塞 | **等待审批** | 高风险动作需审批后才能继续 |
| 运行中 | 运行中 | 不变 |
| 已暂停 | 已暂停 | 不变 |
| 已停止 | 已停止 | 不变 |
| 已完成 | 已完成 | 不变 |

#### 界面文案

| 现有 | 新值 | 出现位置 |
|------|------|----------|
| 编排 / LLM 编排 | **AI 规划** | 调度面板、工作日志 |
| 调度（Tab 名） | **执行控制** | Tab 导航 |
| MCP 工具 | **探测工具** | 面向用户的文案 |
| 收束 | **自动收尾** | 日志、状态描述 |
| 情报（发现严重度） | **信息** | 漏洞发现列表 |

> 注意：代码内部变量名、函数名、类型名保持不变（如 `McpToolRecord`、`orchestrator`），只改用户可见的显示文案。

### D. 数据层修复（端口数据不显示）

**根因：** `refreshStoredProjectResults()` 中 `buildAssetGroups()` 从 Asset 表读取数据并写入 ProjectDetail JSON。如果：
1. 资产提取逻辑在 Round 5 之前运行（旧逻辑不创建 port 资产），或
2. `refreshStoredProjectResults()` 在资产写入后未被调用

则 `assetGroups` JSON 为空，UI 无数据。

**修复方向：**
- Tab 页面直接从 Asset 表实时查询，不再依赖 `assetGroups` JSON 缓存
- 用 `listStoredAssets(projectId)` + 按 type 过滤，替代 `detail.assetGroups.find()`
- 删除 `buildAssetGroups()` 和 `ProjectDetail.assetGroups` 字段（消除缓存不一致问题）

### E. 删除的页面和组件

| 文件 | 原因 |
|------|------|
| `app/(console)/projects/[projectId]/context/page.tsx` | "上下文" Tab 删除 |
| `app/(console)/projects/[projectId]/flow/page.tsx` | "阶段" Tab 删除 |
| `components/projects/project-knowledge-tabs.tsx` | 仅被 context 页面使用 |
| `components/projects/project-stage-flow.tsx` | 仅被 flow 页面使用 |

### F. 需要修改的文件清单

| 文件 | 改动 |
|------|------|
| `components/projects/project-workspace-nav.tsx` | Tab 定义：8→7，更新标签名和路由 |
| `app/(console)/projects/[projectId]/results/domains/page.tsx` | 改为域名专用表格，实时查询 |
| `app/(console)/projects/[projectId]/results/network/page.tsx` | 改为端口专用表格（Nmap 风格），实时查询 |
| 新建 `app/(console)/projects/[projectId]/results/sites/page.tsx` | 站点 Tab 页面 |
| `components/projects/project-results-hub.tsx` | 概览页入口卡片：2→3（域名/站点/端口） |
| `lib/results/project-results-core.ts` | 资产分组逻辑重构，术语更新 |
| `lib/types/asset.ts` | scopeStatus 类型值更新 |
| `lib/types/project.ts` | ProjectStatus 值更新 |
| `lib/gateway/mcp-dispatch-service.ts` | 项目状态文案更新 |
| `lib/platform-config.ts` | 显示文案更新 |
| `components/projects/project-summary.tsx` | 统计卡片标签 + 链接更新 |
| `components/projects/project-scheduler-runtime-panel.tsx` | "编排"→"AI 规划"文案 |
| `components/settings/mcp-gateway-client.tsx` | "MCP 工具"→"探测工具" |
| `prisma/schema.prisma` | 如果 scopeStatus 有默认值需更新 |
| 多个测试文件 | 断言中的状态值更新 |
| E2E 测试 | Tab 名称、按钮文案断言更新 |

## 不变的部分

- 代码内部变量名、函数名、类型名（`McpToolRecord`、`orchestrator-service.ts` 等）
- API 路由路径
- 数据库表结构（仅改显示值，不改字段名）
- 漏洞 Tab 内容和结构
- AI 日志 Tab 内容和结构
- 审批状态值（已批准/已拒绝/已延后/待处理 — 本身清晰）
- 风险等级（高/中/低 — 业界标准）
- 发现严重度中的高危/中危/低危（业界标准）
