// ---------------------------------------------------------------------------
// Scope boundary policy – decides whether a discovered host / URL / IP falls
// within the boundaries implied by the original engagement targets.
// ---------------------------------------------------------------------------

/** Core interface – every scope rule answers two questions. */
export interface ScopePolicy {
  /** Return `true` when `value` falls inside the engagement scope. */
  isInScope(value: string): boolean
  /** Human-readable description of the policy (for audit logs / UI). */
  describe(): string
}

// ---- helpers --------------------------------------------------------------

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** Check whether `value` is a dotted-decimal IPv4 address. */
export function isIPv4(value: string): boolean {
  const m = IPV4_RE.exec(value)
  if (!m) return false
  return m.slice(1).every((octet) => {
    const n = Number(octet)
    return n >= 0 && n <= 255
  })
}

/**
 * Extract the hostname from various input formats:
 *   - plain hostname / IP        → as-is
 *   - host:port                  → host
 *   - https://host/path          → host
 *   - tcp://host:port            → host
 */
export function extractHost(value: string): string {
  let s = value.trim()

  // Strip known scheme prefixes
  const schemeIdx = s.indexOf("://")
  if (schemeIdx !== -1) {
    s = s.slice(schemeIdx + 3)
  }

  // Strip path / query / fragment
  const slashIdx = s.indexOf("/")
  if (slashIdx !== -1) {
    s = s.slice(0, slashIdx)
  }

  // Strip userinfo (user@host)
  const atIdx = s.indexOf("@")
  if (atIdx !== -1) {
    s = s.slice(atIdx + 1)
  }

  // Handle IPv6 bracket notation [::1]:port
  if (s.startsWith("[")) {
    const closeBracket = s.indexOf("]")
    if (closeBracket !== -1) {
      return s.slice(1, closeBracket)
    }
  }

  // Strip port
  const colonIdx = s.lastIndexOf(":")
  if (colonIdx !== -1) {
    const maybePort = s.slice(colonIdx + 1)
    if (/^\d+$/.test(maybePort)) {
      s = s.slice(0, colonIdx)
    }
  }

  return s.toLowerCase()
}

/**
 * Extract the root domain from a hostname.
 *   sub.example.com  → example.com
 *   example.com      → example.com
 *   localhost         → localhost
 *
 * Note: this is a simple heuristic (last two labels). It does not consult the
 * Public Suffix List, which is acceptable for pentest scope decisions.
 */
export function extractRootDomain(hostname: string): string {
  if (isIPv4(hostname)) return hostname
  const parts = hostname.split(".")
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join(".")
}

// ---- internal rule types --------------------------------------------------

interface ScopeRule {
  matches(host: string): boolean
  describe(): string
}

/** Same-domain rule: target example.com → *.example.com in scope. */
class DomainRule implements ScopeRule {
  private readonly root: string
  constructor(private readonly original: string) {
    this.root = extractRootDomain(original)
  }
  matches(host: string): boolean {
    if (host === this.original) return true
    const root = extractRootDomain(host)
    return root === this.root
  }
  describe(): string {
    return `*.${this.root} (same-domain of ${this.original})`
  }
}

/** Same-subnet rule: target IP → /24 in scope. */
class SubnetRule implements ScopeRule {
  private readonly prefix: string // first 3 octets "192.168.1"
  constructor(private readonly original: string) {
    this.prefix = original.split(".").slice(0, 3).join(".")
  }
  matches(host: string): boolean {
    if (!isIPv4(host)) return false
    return host.split(".").slice(0, 3).join(".") === this.prefix
  }
  describe(): string {
    return `${this.prefix}.0/24 (same-subnet of ${this.original})`
  }
}

/** Same-host rule: same IP/hostname, any port → in scope. */
class HostRule implements ScopeRule {
  constructor(private readonly host: string) {}
  matches(host: string): boolean {
    return host === this.host
  }
  describe(): string {
    return `${this.host}:* (same-host)`
  }
}

// ---- factory --------------------------------------------------------------

/**
 * Build a `ScopePolicy` from one or more original engagement targets.
 *
 * Each target may be a domain, IP, URL, or host:port string.  The factory
 * derives a set of rules that together define the engagement boundary.
 */
export function createScopePolicy(targets: string[]): ScopePolicy {
  const rules: ScopeRule[] = []
  const seen = new Set<string>()

  for (const raw of targets) {
    const host = extractHost(raw)
    if (!host || seen.has(host)) continue
    seen.add(host)

    // Always add same-host rule (covers different ports)
    rules.push(new HostRule(host))

    if (isIPv4(host)) {
      rules.push(new SubnetRule(host))
    } else {
      rules.push(new DomainRule(host))
    }
  }

  return {
    isInScope(value: string): boolean {
      const host = extractHost(value)
      return rules.some((r) => r.matches(host))
    },
    describe(): string {
      if (rules.length === 0) return "empty scope (no targets)"
      return rules.map((r) => r.describe()).join("; ")
    },
  }
}
