import pg from "pg"

export type PgListenerCallback = (payload: string) => void

/**
 * Create a raw pg connection for LISTEN/NOTIFY.
 * Prisma doesn't support LISTEN, so we need a separate connection.
 */
export async function createPgListener(
  channel: string,
  callback: PgListenerCallback,
): Promise<{ close: () => Promise<void> }> {
  // Validate channel name to prevent SQL injection
  if (!/^[a-z_][a-z0-9_]*$/i.test(channel)) {
    throw new Error(`Invalid channel name: ${channel}`)
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  })
  await client.connect()
  await client.query(`LISTEN "${channel}"`)

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
