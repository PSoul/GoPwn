import pg from "pg"

export type PgListenerCallback = (payload: string) => void

/**
 * Create a raw pg connection for LISTEN/NOTIFY.
 * Prisma doesn't support LISTEN, so we need a separate connection.
 *
 * @param onError — called when the underlying pg connection drops.
 *   The caller (SSE route) should tear down the stream so the client reconnects.
 */
export async function createPgListener(
  channel: string,
  callback: PgListenerCallback,
  onError?: (err: Error) => void,
): Promise<{ close: () => Promise<void> }> {
  // Validate channel name to prevent SQL injection
  if (!/^[a-z_][a-z0-9_]*$/i.test(channel)) {
    throw new Error(`Invalid channel name: ${channel}`)
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL!,
  })

  // Prevent unhandled 'error' events from crashing the process
  client.on("error", (err) => {
    console.error(`[pg-listener] connection error on channel "${channel}":`, err.message)
    onError?.(err)
  })

  await client.connect()
  try {
    await client.query(`LISTEN "${channel}"`)
  } catch (err) {
    await client.end().catch(() => {})
    throw err
  }

  client.on("notification", (msg) => {
    if (msg.channel === channel && msg.payload) {
      callback(msg.payload)
    }
  })

  return {
    close: async () => {
      await client.query(`UNLISTEN "${channel}"`).catch(() => {})
      await client.end()
    },
  }
}
