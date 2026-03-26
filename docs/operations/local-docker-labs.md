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

这些 ID 由 [lib/local-lab-catalog.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/local-lab-catalog.ts) 维护。

## 注意事项

- 不要把真实 API Key 写进仓库。真实 LLM 只通过环境变量注入。
- 首次启动 `webgoat` 可能比 `juice-shop` 更慢，建议先等待容器稳定再在平台里点击执行。
- 当前 compose 主要服务本地验证，不承担生产级隔离或团队共享环境职责。
