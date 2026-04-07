// mock EventSource：可控触发 onopen / onmessage / onerror
// 提供 instances 数组追踪所有实例（便于测试中获取最近创建的 ES）

export class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  readyState = 0 // CONNECTING
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {
    this.readyState = 2 // CLOSED
    this.closed = true
  }

  // ---- 测试触发器 ----
  triggerOpen() {
    this.readyState = 1 // OPEN
    this.onopen?.()
  }
  triggerMessage(data: string) {
    this.onmessage?.({ data })
  }
  triggerError(err?: unknown) {
    this.onerror?.(err ?? new Error("connection lost"))
  }

  static reset() {
    MockEventSource.instances = []
  }
}
