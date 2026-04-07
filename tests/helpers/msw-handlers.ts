import { http, HttpResponse, delay } from "msw"

const BASE = "https://api.openai.test/v1"

// 正常 chat 响应
export function chatOk(content: string, model = "gpt-4") {
  return http.post(`${BASE}/chat/completions`, () =>
    HttpResponse.json({
      choices: [{ message: { content } }],
      model,
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
  )
}

// Function call 响应
export function chatFunctionCall(name: string, args: string) {
  return http.post(`${BASE}/chat/completions`, () =>
    HttpResponse.json({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name, arguments: args },
              },
            ],
          },
        },
      ],
      model: "gpt-4",
    }),
  )
}

// 429 Rate Limit
export function chat429() {
  return http.post(
    `${BASE}/chat/completions`,
    () =>
      new HttpResponse("Rate limited", {
        status: 429,
        headers: { "retry-after": "5" },
      }),
  )
}

// 500 Server Error
export function chat500() {
  return http.post(
    `${BASE}/chat/completions`,
    () => new HttpResponse("Internal Server Error", { status: 500 }),
  )
}

// 延迟超时
export function chatSlow(ms: number) {
  return http.post(`${BASE}/chat/completions`, async () => {
    await delay(ms)
    return HttpResponse.json({
      choices: [{ message: { content: "late" } }],
    })
  })
}

// 畸形 JSON
export function chatMalformed() {
  return http.post(
    `${BASE}/chat/completions`,
    () =>
      new HttpResponse("{invalid json", {
        headers: { "content-type": "application/json" },
      }),
  )
}
