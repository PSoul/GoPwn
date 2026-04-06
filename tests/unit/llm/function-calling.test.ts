import { describe, it, expect } from "vitest"
import {
  mcpToolToFunction,
  mcpToolsToFunctions,
  getControlFunctions,
} from "@/lib/llm/function-calling"

describe("function-calling: mcpToolToFunction", () => {
  it("基本转换：工具名、描述、参数", () => {
    const tool = {
      toolName: "fscan_port_scan",
      description: "扫描目标端口",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "目标地址" },
          ports: { type: "string", description: "端口范围" },
        },
        required: ["target"],
      },
    }

    const fn = mcpToolToFunction(tool)

    expect(fn.name).toBe("fscan_port_scan")
    expect(fn.description).toBe("扫描目标端口")
    expect(fn.parameters).toEqual({
      type: "object",
      properties: {
        target: { type: "string", description: "目标地址" },
        ports: { type: "string", description: "端口范围" },
      },
      required: ["target"],
    })
  })

  it("inputSchema 为 null 时使用空对象", () => {
    const tool = {
      toolName: "simple_tool",
      description: "简单工具",
      inputSchema: null,
    }

    const fn = mcpToolToFunction(tool)
    expect(fn.parameters).toEqual({ type: "object", properties: {} })
  })

  it("inputSchema 为 undefined 时使用空对象", () => {
    const tool = {
      toolName: "simple_tool",
      description: "",
      inputSchema: undefined,
    }

    const fn = mcpToolToFunction(tool)
    expect(fn.parameters).toEqual({ type: "object", properties: {} })
  })

  it("description 为空时使用 fallback 描述", () => {
    const tool = {
      toolName: "my_tool",
      description: "",
      inputSchema: {},
    }

    const fn = mcpToolToFunction(tool)
    expect(fn.description).toBe("MCP tool: my_tool")
  })

  it("没有 required 字段时不包含 required", () => {
    const tool = {
      toolName: "no_required",
      description: "无必填参数",
      inputSchema: {
        properties: { foo: { type: "string" } },
      },
    }

    const fn = mcpToolToFunction(tool)
    expect(fn.parameters).not.toHaveProperty("required")
  })
})

describe("function-calling: mcpToolsToFunctions", () => {
  it("批量转换多个工具", () => {
    const tools = [
      { toolName: "tool_a", description: "A", inputSchema: {} },
      { toolName: "tool_b", description: "B", inputSchema: {} },
    ]

    const fns = mcpToolsToFunctions(tools)
    expect(fns).toHaveLength(2)
    expect(fns[0].name).toBe("tool_a")
    expect(fns[1].name).toBe("tool_b")
  })

  it("空数组返回空数组", () => {
    expect(mcpToolsToFunctions([])).toEqual([])
  })
})

describe("function-calling: getControlFunctions", () => {
  it("包含 done 和 report_finding 两个控制函数", () => {
    const fns = getControlFunctions()
    expect(fns).toHaveLength(2)

    const names = fns.map((f) => f.name)
    expect(names).toContain("done")
    expect(names).toContain("report_finding")
  })

  it("done 函数需要 summary 参数", () => {
    const fns = getControlFunctions()
    const done = fns.find((f) => f.name === "done")!
    const params = done.parameters as { required?: string[] }
    expect(params.required).toContain("summary")
  })

  it("report_finding 函数需要 title/severity/target/detail", () => {
    const fns = getControlFunctions()
    const report = fns.find((f) => f.name === "report_finding")!
    const params = report.parameters as { required?: string[] }
    expect(params.required).toEqual(
      expect.arrayContaining(["title", "severity", "target", "detail"]),
    )
  })
})
