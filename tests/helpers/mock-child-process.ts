import { EventEmitter } from "events"
import { PassThrough } from "stream"

export function createMockChildProcess() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const emitter = new EventEmitter()
  const proc = Object.assign(emitter, {
    stdin,
    stdout,
    stderr,
    pid: 12345,
    killed: false,
    kill(signal?: string) {
      this.killed = true
      emitter.emit("exit", signal === "SIGKILL" ? 137 : 0, signal)
    },
  })
  return { proc, stdin, stdout, stderr }
}
