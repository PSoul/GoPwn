# 本地 Docker 靶场

## 目标

这个目录用于给平台提供一组可重复启动的本地漏洞靶场，优先服务于以下验证目标：

- 验证 `LLM -> 计划 -> MCP 调度 -> 审批阻塞 -> 审批恢复 -> 结果沉淀` 整条主链
- 给前后端联调提供稳定、低成本、可重复的目标环境
- 为后续接入真实 LLM 和更多 MCP 工具提供固定回归样本

当前默认提供两个靶场：

- `juice-shop`
  - 入口：`http://127.0.0.1:3000`
  - 镜像：`bkimminich/juice-shop`
- `webgoat`
  - 入口：`http://127.0.0.1:8080/WebGoat`
  - 镜像：`webgoat/webgoat`
  - 辅助端口：`9090`

## 启动

在项目根目录执行：

```powershell
docker compose -f docker/local-labs/compose.yaml up -d
```

查看状态：

```powershell
docker compose -f docker/local-labs/compose.yaml ps
```

停止并清理容器：

```powershell
docker compose -f docker/local-labs/compose.yaml down
```

## 主机侧连通性检查

建议在平台里点击“执行本地闭环”前，先从宿主机确认端口已经起来：

```powershell
Invoke-WebRequest http://127.0.0.1:3000 | Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:8080/WebGoat | Select-Object StatusCode
```

如果返回 `200`、`302` 或可预期的应用首页内容，平台中的本地靶场探测通常就能识别为 `online`。

## 命令行实流验证

除了在页面里手动点击，现在也可以直接通过命令行跑一条完整的真实链路，用于回归或交付前验收。

先准备真实 LLM 环境变量：

```powershell
$env:LLM_API_KEY = "..."
$env:LLM_BASE_URL = "https://api.siliconflow.cn/v1"
$env:LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
$env:LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
```

然后执行：

```powershell
npm run live:validate
```

常用可选参数：

```powershell
$env:LIVE_VALIDATION_LAB_ID = "juice-shop"   # 或 webgoat
$env:LIVE_VALIDATION_PROJECT_ID = "proj-huayao"
$env:LIVE_VALIDATION_PORT = "3301"
$env:LIVE_VALIDATION_AUTO_APPROVE = "1"      # 默认自动审批恢复
$env:LIVE_VALIDATION_START_LABS = "1"        # 默认自动执行 docker compose up -d
$env:LIVE_VALIDATION_STOP_LABS = "0"         # 默认不自动 down，方便重复调试
```

脚本会自动完成以下动作：

1. 拉起本地 Docker 靶场
2. 启动 Next.js 运行时，并为这次联调创建独立的 `PROTOTYPE_DATA_DIR`
3. 调用登录 API 获取研究员会话
4. 调用编排计划 API
5. 调用本地验证 API
6. 如命中待审批动作，则自动批准并等待执行结果回流
7. 抓取项目上下文、MCP run 列表、MCP 服务器调用记录
8. 输出 Markdown + JSON 报告

输出目录：

- `output/live-validation/<timestamp>-<lab-id>/report.md`
- `output/live-validation/<timestamp>-<lab-id>/report.json`
- `output/live-validation/<timestamp>-<lab-id>/next-server.log`
- `output/live-validation-state/<timestamp>-<lab-id>/`

当前已验证通过的一条真实链路样例：

- `output/live-validation/2026-03-27T00-36-31-804Z-juice-shop/`
- 该样例证明了 `真实 LLM -> 计划 -> MCP 调度 -> 真实 Web stdio MCP -> 审批恢复 -> 资产/证据/发现沉淀`

## 在平台中的使用方式

1. 登录平台后进入 `/projects/:projectId/operations`
2. 在“LLM 编排与本地闭环”里选择一个靶场
3. 先点“生成计划”，确认计划项里是否包含你需要的能力族
4. 再点“执行本地闭环”

建议先用两种模式各跑一遍：

- 开启“审批演练开关”
  - 计划中会包含一条高风险动作，用来验证审批暂停与恢复
- 关闭“审批演练开关”
  - 只验证低风险自动流转

## 和平台内置 ID 的对应关系

本地编排面板当前识别以下靶场 ID：

- `juice-shop`
- `webgoat`

这些 ID 由 `lib/local-lab-catalog.ts` 维护。

## 注意事项

- 不要把真实 API Key 写进仓库。真实 LLM 只通过环境变量注入。
- 首次启动 `webgoat` 可能比 `juice-shop` 更慢，建议先等待容器稳定再在平台里点击执行。
- 在当前这台 Windows + Docker Desktop 环境里，`webgoat` 容器内部已经可访问，但宿主机的 `127.0.0.1:8080` 端口暂时没有正常暴露；因此命令行 runner 对 `webgoat` 的主机侧健康检查会失败。这是当前环境问题，不是平台编排链路的协议错误。
- 当前 compose 主要服务本地验证，不承担生产级隔离或团队共享环境职责。
