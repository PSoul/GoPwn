import { execSync, spawn } from "node:child_process"

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3005)

function killPort(targetPort) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })

      const pids = new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split(/\s+/).at(-1))
          .filter((pid) => pid && pid !== "0"),
      )

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" })
        } catch {}
      }

      return
    }

    const output = execSync(`lsof -ti tcp:${targetPort}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })

    const pids = new Set(output.split(/\r?\n/).filter(Boolean))

    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGKILL")
      } catch {}
    }
  } catch {}
}

killPort(port)

const command = ["npx", "playwright", "test", ...process.argv.slice(2)].join(" ")
const child = spawn(command, {
  shell: true,
  stdio: "inherit",
})

child.on("exit", (code) => {
  process.exit(code ?? 1)
})
