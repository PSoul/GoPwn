# Phase 10 Prompt: Network Discovery and Evidence Closure

你现在接手的是一个已经具备以下能力的 `LLM 渗透测试平台` 全栈原型：

- `Next.js + API + 本地持久化`
- 账号登录、中间件鉴权、项目生命周期控制（`idle / running / paused / stopped`）
- 真实 `DNS / 子域 / 证书情报类` connector
- 真实 `Web 页面探测类` stdio MCP
- 真实 `HTTP / API 结构发现类` stdio MCP
- 真实 `受控验证类` stdio MCP
- 真实 `截图与证据采集类` Playwright stdio MCP
- 资产 / 证据 / 漏洞与发现 / 调度 / 审计 的真实持久化与页面展示
- `Juice Shop` 与 `WebGoat` 已有真实本地闭环验证基础

你必须在新的隔离分支/worktree 中继续开发，不能污染当前分支。

## 本阶段目标

把平台从“Web 入口 + HTTP 验证 + 证据截图”的能力，继续推进到“更完整的项目闭环”：

1. 接入真实 `端口探测类` MCP
2. 把 `capture-evidence` 真正纳入 `npm run live:validate` 与项目闭环
3. 至少跑通一个保留真实 screenshot / HTML artifact 的本地靶场项目闭环
4. 继续完善结果页和项目详情，让网络面与证据面展示更清晰

## 必做事项

### 1. 真实 `端口探测类` MCP

请新增一个真实可运行的 `端口探测类` MCP，要求：

- 使用标准 MCP contract 注册到平台
- 有清晰的输入 schema / 输出 schema
- 能对本地靶场或本地授权目标执行基础端口识别
- 输出至少应能沉淀：
  - IP / host
  - port
  - protocol
  - service name
  - banner / version / fingerprint（如果拿得到）
- 结果必须进入：
  - 资产中心
  - 项目结果页
  - 必要时进入证据/日志

优先推荐：

- 低风险、只读
- 适合本地 Windows + Docker Desktop 环境
- 允许对 `127.0.0.1` 与容器映射端口做测试

### 2. 把 `capture-evidence` 接入真实闭环

当前 `capture-evidence` 已经有：

- stdio MCP server
- connector
- artifact 存储
- `/api/artifacts/[...artifactPath]`
- 证据详情页截图/HTML 展示

但还缺少：

- 在 `npm run live:validate` 中自动纳入计划 / 执行
- 在真实项目闭环里留下可查看的 screenshot / HTML evidence

你需要把它接入到真实项目闭环中。

要求：

- `live:validate` 生成的真实项目，至少有一条 evidence 记录带 screenshot + HTML artifact
- 正常项目页 `/evidence/[id]` 能直接打开并看到
- 不允许只是测试夹具生成，必须经过真实平台调度路径

### 3. 再完成一次真实靶场闭环

请选择一个当前最合适的本地靶场闭环（建议优先 `WebGoat`），从以下链路跑通：

1. 新建项目
2. 手动开始项目
3. LLM 生成计划
4. MCP 调度执行
5. 至少沉淀：
   - 资产
   - 证据
   - screenshot / HTML artifact
   - 如果可行，再带一条 finding
6. 页面内可查看结果
7. 报告可导出

要求：

- 保留真实项目数据
- 不要用 mock 结果伪装成功
- 如果环境阻塞，要把阻塞点记录进 `roadmap.md`

### 4. 前端结果页继续优化

围绕“漏洞扫描器 / 结果工作台”的概念继续优化展示：

- 项目详情与结果页里，网络面结果要更明确
- `IP / 端口 / 服务` 表格要适合高数量结果
- 证据页对有 artifact 的 evidence 应更容易识别
- 如有必要，增加 evidence 列表中的“有截图 / 有 HTML”标识

### 5. 文档和索引必须同步更新

完成后必须更新：

- `README.md`
- `code_index.md`
- `roadmap.md`

如果没有对应条目，就新增。

## 强制要求

1. 开发前必须新建分支/worktree
2. 不允许破坏当前已有真实闭环能力
3. 必须优先使用真实数据，不要新增静态 mock 展示
4. 如有必要，使用 Context7 和 WebSearch 获取官方资料
5. 完成后必须跑完整验证：
   - `npm run test`
   - `npm run lint`
   - `npm run build`
   - `npm run e2e`
   - 如有必要，补一次 `npm run live:validate`

## 验收标准

- 平台中出现真实 `端口探测类` MCP，并能完成注册、调度、结果沉淀
- `capture-evidence` 不再只是独立能力，而是能进入真实闭环
- 至少一个真实本地靶场项目在普通页面里留下了 screenshot / HTML artifact
- `code_index.md` 和 `roadmap.md` 足够让下一个 LLM 无缝接手
- 所有自动化测试通过
