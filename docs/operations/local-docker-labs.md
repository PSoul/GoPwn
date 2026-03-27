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
  - 入口：默认 `http://127.0.0.1:18080/WebGoat`
  - 镜像：`webgoat/webgoat`
  - 辅助端口：宿主机默认 `19090` 映射到容器内 `9090`
  - 平台默认按 `18080:8080` 启动；如需覆盖，请同步设置 `WEBGOAT_HOST_PORT`

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
Invoke-WebRequest http://127.0.0.1:18080/WebGoat | Select-Object StatusCode
```

如果返回 `200`、`302` 或可预期的应用首页内容，平台中的本地靶场探测通常就能识别为 `online`。

如果你怀疑原来的 `8080` 被其它进程占用，先检查：

```powershell
netstat -ano | findstr :8080
```

当前仓库已经默认把 WebGoat 的宿主机映射改为 `18080:8080`。如果你手工改成其它端口，请在启动平台或 live runner 前同步设置：

```powershell
$env:WEBGOAT_HOST_PORT = "18080"
```

这样 `catalog`、编排 API 与 live runner 都会统一指向对应的宿主机入口。当前默认入口为 `http://127.0.0.1:18080/WebGoat`。如果宿主机端口仍不可达，但容器内 `/WebGoat/actuator/health` 可达，平台会把状态标记为“容器内可达”，并继续允许 WebGoat 闭环调试。

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
$env:WEBGOAT_HOST_PORT = "18080"             # 可选；默认 compose 已使用 18080:8080，只有你手工改端口时才需要覆盖
$env:LIVE_VALIDATION_PROJECT_ID = "proj-20260327-f6a3fd0c"  # 可选；不填时会自动创建真实项目
$env:LIVE_VALIDATION_PORT = "3301"
$env:LIVE_VALIDATION_AUTO_APPROVE = "1"      # 默认自动审批恢复
$env:LIVE_VALIDATION_START_LABS = "1"        # 默认自动执行 docker compose up -d
$env:LIVE_VALIDATION_STOP_LABS = "0"         # 默认不自动 down，方便重复调试
$env:LIVE_VALIDATION_STATE_MODE = "isolated" # isolated / workspace
$env:LIVE_VALIDATION_STATE_DIR = "D:\\temp\\prototype-store-live" # 可选，手动指定状态目录
```

脚本会自动完成以下动作：

1. 拉起本地 Docker 靶场
2. 启动 Next.js 运行时，并按 `LIVE_VALIDATION_STATE_MODE` 选择独立 store 或当前工作区 store
3. 调用登录 API 获取研究员会话
4. 如当前 store 还没有 `web-surface-stdio` 与 `http-structure-stdio`，先自动完成 MCP 注册
5. 如果没有显式传入 `LIVE_VALIDATION_PROJECT_ID`，自动创建真实项目
6. 调用编排计划 API
7. 调用本地验证 API
8. 如命中待审批动作，则自动批准并等待执行结果回流
9. 抓取项目上下文、MCP run 列表、MCP 服务器调用记录
10. 输出 Markdown + JSON 报告

输出目录：

- `output/live-validation/<timestamp>-<lab-id>/report.md`
- `output/live-validation/<timestamp>-<lab-id>/report.json`
- `output/live-validation/<timestamp>-<lab-id>/next-server.log`
- `output/live-validation-state/<timestamp>-<lab-id>/`（默认 `isolated` 模式）

状态持久化模式：

- `LIVE_VALIDATION_STATE_MODE=isolated`
  - 默认值
  - 每次跑独立 store，不污染当前工作区
- `LIVE_VALIDATION_STATE_MODE=workspace`
  - 将真实项目、资产、证据、发现直接保留到当前工作区 `.prototype-store/`
  - 适合你想在普通 `/projects`、`/evidence`、`/assets` 页面里继续查看真实闭环结果的时候
- `LIVE_VALIDATION_STATE_DIR`
  - 可选
  - 手动覆盖最终使用的状态目录

当前已验证通过的一条真实链路样例：

- `output/live-validation/2026-03-27T05-09-27-704Z-juice-shop/`
- 对应真实项目：`proj-20260327-f6a3fd0c`
- 该样例证明了 `真实 LLM -> 计划 -> MCP 调度 -> 真实 Web stdio MCP -> 审批恢复 -> 资产/证据/发现沉淀`
- 当时使用了 workspace-mode 持久化，所以结果会保留在普通项目页、证据页、发现页中

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
- SiliconFlow 这类真实模型端点可能明显慢于本地 mock。当前 runner 会把 `LLM_TIMEOUT_MS` 默认抬到 `300000`（5 分钟），避免真实编排在长响应下被过早中断。
- 首次启动 `webgoat` 可能比 `juice-shop` 更慢，建议先等待容器稳定再在平台里点击执行。
- 在当前这台 Windows + Docker Desktop 环境里，`webgoat` 可能出现“容器内可访问，但宿主机端口未正常暴露”的情况。平台现在会把这类状态标记为容器内可达，并允许 `web-surface` 与 `HTTP / API 结构发现` 通过 `docker exec wget` fallback 继续调试。
- 如果你把 WebGoat 改绑到非默认端口，请记得同步设置 `WEBGOAT_HOST_PORT`；否则编排面板和 live runner 仍会按默认 `18080` 访问。
- 当前 compose 主要服务本地验证，不承担生产级隔离或团队共享环境职责。
