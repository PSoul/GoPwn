import { describe, it, expect } from "vitest"
import {
  createScopePolicy,
  extractHost,
  extractRootDomain,
  isIPv4,
} from "@/lib/domain/scope-policy"

describe("scope-policy helpers", () => {
  describe("isIPv4", () => {
    it("合法 IPv4 → true", () => {
      expect(isIPv4("192.168.1.1")).toBe(true)
      expect(isIPv4("0.0.0.0")).toBe(true)
      expect(isIPv4("255.255.255.255")).toBe(true)
    })

    it("非法 IPv4 → false", () => {
      expect(isIPv4("256.1.1.1")).toBe(false)
      expect(isIPv4("abc")).toBe(false)
      expect(isIPv4("192.168.1")).toBe(false)
      expect(isIPv4("")).toBe(false)
    })
  })

  describe("extractHost", () => {
    it("URL 格式 → 提取 hostname", () => {
      expect(extractHost("https://example.com:8080/path")).toBe("example.com")
      expect(extractHost("http://test.local/api")).toBe("test.local")
    })

    it("tcp 协议 → 提取 host", () => {
      expect(extractHost("tcp://10.0.0.1:22")).toBe("10.0.0.1")
    })

    it("userinfo 格式 → 提取 host", () => {
      expect(extractHost("user@host.local")).toBe("host.local")
    })

    it("纯 host:port → 提取 host", () => {
      expect(extractHost("192.168.1.1:8080")).toBe("192.168.1.1")
    })

    it("纯 hostname → 原样返回（小写）", () => {
      expect(extractHost("Example.COM")).toBe("example.com")
    })
  })

  describe("extractRootDomain", () => {
    it("子域名 → 提取根域", () => {
      expect(extractRootDomain("sub.example.com")).toBe("example.com")
      expect(extractRootDomain("a.b.c.example.com")).toBe("example.com")
    })

    it("根域 → 原样返回", () => {
      expect(extractRootDomain("example.com")).toBe("example.com")
    })

    it("单标签 → 原样返回", () => {
      expect(extractRootDomain("localhost")).toBe("localhost")
    })

    it("IPv4 → 原样返回", () => {
      expect(extractRootDomain("192.168.1.1")).toBe("192.168.1.1")
    })
  })
})

describe("scope-policy createScopePolicy", () => {
  it("域名目标 → 同根域子域名在 scope 内", () => {
    const policy = createScopePolicy(["https://app.example.com"])
    expect(policy.isInScope("api.example.com")).toBe(true)
    expect(policy.isInScope("https://other.example.com:8080/path")).toBe(true)
    expect(policy.isInScope("evil.com")).toBe(false)
  })

  it("IP 目标 → 同 /24 子网在 scope 内", () => {
    const policy = createScopePolicy(["192.168.1.100"])
    expect(policy.isInScope("192.168.1.200")).toBe(true)
    expect(policy.isInScope("192.168.2.1")).toBe(false)
  })

  it("多个目标 → 任一匹配即在 scope 内", () => {
    const policy = createScopePolicy([
      "https://app.example.com",
      "10.0.0.1",
    ])
    expect(policy.isInScope("api.example.com")).toBe(true)
    expect(policy.isInScope("10.0.0.50")).toBe(true)
    expect(policy.isInScope("evil.com")).toBe(false)
  })

  it("空目标 → 什么都不在 scope 内", () => {
    const policy = createScopePolicy([])
    expect(policy.isInScope("anything")).toBe(false)
    expect(policy.describe()).toContain("empty scope")
  })

  it("describe → 返回人类可读描述", () => {
    const policy = createScopePolicy(["https://app.example.com"])
    const desc = policy.describe()
    expect(desc).toContain("example.com")
  })
})
