// @vitest-environment node
import { describe, expect, it } from "vitest"

import { analyzeFailure, formatFailureForPrompt } from "@/lib/analysis/failure-analyzer"

describe("analyzeFailure", () => {
  it("classifies timeout errors correctly", () => {
    const result = analyzeFailure("httpx_probe", "http://example.com", "Request timed out after 30s")
    expect(result.failureCategory).toBe("timeout")
    expect(result.worthRetrying).toBe(true)
    expect(result.likelyCause).toContain("超时")
  })

  it("classifies connection refused errors", () => {
    const result = analyzeFailure("tcp_connect", "192.168.1.1:8080", "ECONNREFUSED")
    expect(result.failureCategory).toBe("connection_refused")
    expect(result.likelyCause).toContain("拒绝连接")
  })

  it("classifies DNS failure errors", () => {
    const result = analyzeFailure("subfinder_enum", "nonexistent.local", "getaddrinfo ENOTFOUND")
    expect(result.failureCategory).toBe("dns_failure")
    expect(result.likelyCause).toContain("DNS")
  })

  it("classifies auth required errors", () => {
    const result = analyzeFailure("curl_http_request", "http://example.com/admin", "HTTP 401 Unauthorized")
    expect(result.failureCategory).toBe("auth_required")
  })

  it("classifies rate limited errors", () => {
    const result = analyzeFailure("httpx_probe", "http://example.com", "429 Too Many Requests")
    expect(result.failureCategory).toBe("rate_limited")
  })

  it("classifies host unreachable errors", () => {
    const result = analyzeFailure("tcp_connect", "10.0.0.1:22", "EHOSTUNREACH")
    expect(result.failureCategory).toBe("target_down")
    expect(result.worthRetrying).toBe(false)
  })

  it("classifies output overflow errors", () => {
    const result = analyzeFailure("fscan_port_scan", "10.0.0.0/24", "maxBuffer exceeded")
    expect(result.failureCategory).toBe("output_overflow")
  })

  it("classifies scope violation errors", () => {
    const result = analyzeFailure("httpx_probe", "http://out-of-scope.com", "target out of scope")
    expect(result.failureCategory).toBe("scope_violation")
    expect(result.worthRetrying).toBe(false)
  })

  it("classifies generic tool errors", () => {
    const result = analyzeFailure("afrog_poc_scan", "http://example.com", "Error: process exited with code 1")
    expect(result.failureCategory).toBe("tool_error")
  })

  it("classifies unknown errors", () => {
    const result = analyzeFailure("unknown_tool", "target", "something completely unexpected happened")
    expect(result.failureCategory).toBe("unknown")
  })

  it("truncates error messages to 500 chars", () => {
    const longError = "x".repeat(1000)
    const result = analyzeFailure("tool", "target", longError)
    expect(result.errorMessage.length).toBe(500)
  })

  it("returns tool-specific timeout retry advice for fscan", () => {
    const result = analyzeFailure("fscan_port_scan", "10.0.0.1", "connection timed out")
    expect(result.suggestedRetry).toContain("端口范围")
  })

  it("stops suggesting retry after max retries", () => {
    const result = analyzeFailure("httpx_probe", "http://example.com", "Request timed out", 5)
    expect(result.worthRetrying).toBe(false)
  })
})

describe("formatFailureForPrompt", () => {
  it("formats a retryable failure with suggestion", () => {
    const analysis = analyzeFailure("httpx_probe", "http://example.com", "Connection timed out")
    const formatted = formatFailureForPrompt(analysis)
    expect(formatted).toContain("httpx_probe")
    expect(formatted).toContain("example.com")
    expect(formatted).toContain("建议重试")
  })

  it("formats a non-retryable failure without retry suggestion", () => {
    const analysis = analyzeFailure("tcp_connect", "10.0.0.1:22", "EHOSTUNREACH")
    const formatted = formatFailureForPrompt(analysis)
    expect(formatted).toContain("跳过此目标")
    expect(formatted).not.toContain("建议重试")
  })

  it("includes alternative tool suggestion when available", () => {
    const analysis = analyzeFailure("fscan_port_scan", "10.0.0.1", "timed out after 60s")
    const formatted = formatFailureForPrompt(analysis)
    expect(formatted).toContain("替代方案")
  })
})
