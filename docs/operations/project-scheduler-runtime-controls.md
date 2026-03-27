# 项目调度运行控制

## 目的

这份文档描述项目二级页 `/projects/[projectId]/operations` 中新增的“调度运行控制”面板，以及它对真实持久化调度队列的实际影响范围。

## 控制边界

- 审批控制决定某个动作是否允许继续执行。
- 调度控制决定已经进入调度体系的任务何时继续认领、是否暂停、以及失败后如何恢复。
- 项目级调度暂停不会回滚审批结果，也不会强制中止已经在运行中的短流程任务。
- 当前切片新增 durable worker 语义，但仍然只覆盖平台侧的租约、心跳、恢复和结果写回控制，不等同于远端连接器的真正 cooperative cancellation。

## Durable Worker 语义

- 每个进入 `running` 的 scheduler task 都会记录：
  - `workerId`
  - `leaseToken`
  - `leaseStartedAt`
  - `heartbeatAt`
  - `leaseExpiresAt`
- 调度器认领任务后，会在平台侧定期刷新心跳并续租。
- 如果平台进程异常退出、浏览器触发链路中断，或者旧执行没有继续续租，后续 drain 会先检查：
  - 租约过期的 `running` 任务
  - 缺少租约元数据的旧版 `running` 任务
- 满足上述条件的任务会被恢复回 `ready` 队列，并记录：
  - `recoveryCount`
  - `lastRecoveredAt`
- 旧 worker 即使晚到返回结果，也必须同时匹配当前的 `workerId + leaseToken` 才允许继续写入资产、证据和发现；否则平台会丢弃这次过期写回。

## 项目级控制

- `paused = true`
  调度器不会继续认领该项目中状态为 `ready`、`retry_scheduled`、`delayed` 的任务。
- `paused = false`
  调度器恢复认领该项目中符合执行条件的任务。
- `note`
  给研究员记录暂停原因、恢复窗口或风险说明，便于后续人工交接。

## 任务级动作

- `cancel`
  允许对 `ready`、`retry_scheduled`、`delayed`、`running` 状态任务执行。动作会：
  - 将 scheduler task 标记为 `cancelled`
  - 将关联 MCP run 标记为 `已取消`
  - 写入项目 activity 与 audit log
  - 如果任务原本处于 `running`，则该动作被视为“停止请求”：
    - 平台会阻止后续结果继续推进队列
    - 如果执行结果尚未提交，平台会阻止其继续写入资产、证据和发现链路
    - 如果该任务随后被 durable worker 恢复或重新认领，旧租约对应的晚到结果也会被 fencing 拦住
    - 当前原型仍不承诺强制杀掉远端 MCP 进程
- `retry`
  仅允许对 `failed` 状态任务执行。动作会：
  - 清空最近错误
  - 将 scheduler task 恢复为 `ready`
  - 将关联 MCP run 标记回 `执行中`
  - 写入项目 activity 与 audit log

## API 契约

### 更新项目调度控制

- 路径: `PATCH /api/projects/:projectId/scheduler-control`
- 请求体:

```json
{
  "paused": true,
  "note": "测试项目临时暂停调度，等待人工确认运行窗口。"
}
```

### 执行任务级调度动作

- 路径: `PATCH /api/projects/:projectId/scheduler-tasks/:taskId`
- 请求体:

```json
{
  "action": "cancel",
  "note": "研究员手动取消当前排队任务。"
}
```

或

```json
{
  "action": "retry",
  "note": "研究员确认后重新排队。"
}
```

## 当前限制

- 运行中的任务当前支持“停止请求”，但仍不保证强制中断远端实际进程；它首先保证的是平台内部不再继续推进和提交结果。
- `AbortController` 目前只用于平台侧 heartbeat 生命周期控制，不会直接透传为远端 MCP / 连接器的真正取消信号。
- 当前调度队列仍以文件存储为主，适合单工作区原型验证，不适合作为最终的长期执行后端。
