/**
 * Next.js instrumentation — runs once when the server starts.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Force IPv4 DNS resolution to avoid Node.js defaulting to IPv6
    // which causes connection timeouts on Windows and Docker environments
    const dns = await import("node:dns")
    dns.setDefaultResultOrder("ipv4first")
  }
}
