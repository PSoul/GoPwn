# Durable Execution Stop Requests Implementation Plan

## Goal

Give operators a truthful first version of running-task stop control: when a task is already marked `running`, the project operations page should allow a stop request that closes the persisted run, prevents further queue progression, and blocks execution-result commit when the task has already been cancelled before writeback.

## Scope

- extend scheduler operator controls to accept stop requests on `running` tasks
- keep the same project-scoped scheduler task API shape and reuse the existing `cancel` action
- update the runtime queue panel so `running` tasks surface a `请求停止` control instead of a disabled `取消排队`
- guard execution-result commit so cancelled tasks do not continue writing assets, evidence, or findings into the platform
- document the new prototype semantics and current limitation that this is not yet a hard remote kill

## Verification

- repository tests for queued cancel, failed retry, and running stop request
- API tests for running stop request through `/api/projects/:projectId/scheduler-tasks/:taskId`
- UI tests for runtime panel stop-request affordance
- execution-service guard test proving cancelled tasks do not commit normalized results
