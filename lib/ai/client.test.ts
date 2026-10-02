import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { AiError, chatJson } from "./client"

const cfg = { baseUrl: "https://example.test/v1/", apiKey: "k", model: "m" }
const schema = z.object({ ok: z.boolean() })

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })
}

describe("chatJson", () => {
  it("posts to /chat/completions with auth and returns parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply('{"ok":true}'))
    await expect(chatJson(cfg, [{ role: "user", content: "hi" }], schema, { fetchImpl })).resolves.toEqual({ ok: true })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://example.test/v1/chat/completions")
    expect(init.headers.Authorization).toBe("Bearer k")
    expect(JSON.parse(init.body).model).toBe("m")
  })

  it("omits Authorization when there is no key (Ollama)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply('{"ok":true}'))
    await chatJson({ ...cfg, apiKey: null }, [], schema, { fetchImpl })
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it("retries once with a JSON-only reminder when the first reply is garbage", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(reply("I think it's fine")).mockResolvedValueOnce(reply('{"ok":false}'))
    await expect(chatJson(cfg, [{ role: "user", content: "x" }], schema, { fetchImpl })).resolves.toEqual({ ok: false })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const msgs = JSON.parse(fetchImpl.mock.calls[1][1].body).messages
    expect(msgs.at(-1).content).toMatch(/JSON/)
  })

  it("gives up after the retry with a Vietnamese parse error", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => reply("nope"))
    await expect(chatJson(cfg, [], schema, { fetchImpl })).rejects.toThrow(/không đúng định dạng/)
  })

  it("maps 401 to an invalid-key message without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    const err = await chatJson(cfg, [], schema, { fetchImpl }).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.message).toMatch(/API key không hợp lệ/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("maps 429 to a quota message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }))
    await expect(chatJson(cfg, [], schema, { fetchImpl })).rejects.toThrow(/quota/)
  })

  it("times out", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))),
    )
    await expect(chatJson(cfg, [], schema, { fetchImpl: fetchImpl as never, timeoutMs: 20 })).rejects.toThrow(/Quá thời gian/)
  })
})
