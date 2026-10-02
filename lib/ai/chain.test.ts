import { describe, expect, it, vi } from "vitest"
import { AiError } from "./client"
import { ChainError, runChain } from "./chain"

const entries = [
  { connectionId: "or", model: "a" },
  { connectionId: "or", model: "b" },
  { connectionId: "gm", model: "c" },
]

describe("runChain", () => {
  it("returns the first success and which entry answered", async () => {
    const attempt = vi.fn().mockResolvedValueOnce("ok-a")
    await expect(runChain(entries, attempt)).resolves.toMatchObject({ data: "ok-a", index: 0, failures: [] })
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it("falls back to the next entry on quota / server / timeout / parse errors", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new AiError("quota", "quota"))
      .mockRejectedValueOnce(new AiError("parse", "parse"))
      .mockResolvedValueOnce("ok-c")
    const r = await runChain(entries, attempt)
    expect(r).toMatchObject({ data: "ok-c", index: 2 })
    expect(r.failures.map((f) => f.kind)).toEqual(["quota", "parse"])
  })

  it("skips the rest of a connection after an auth error but keeps other connections", async () => {
    const attempt = vi.fn().mockRejectedValueOnce(new AiError("bad key", "auth")).mockResolvedValueOnce("ok-c")
    const r = await runChain(entries, attempt)
    expect(r.index).toBe(2)
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(attempt.mock.calls.map((c) => c[1])).toEqual([0, 2])
  })

  it("throws a ChainError listing every failure when nothing works", async () => {
    const attempt = vi.fn().mockRejectedValue(new AiError("down", "server"))
    const err = await runChain(entries, attempt).catch((e) => e)
    expect(err).toBeInstanceOf(ChainError)
    expect(err.failures).toHaveLength(3)
    expect(err.message).toMatch(/#1 a/)
    expect(err.message).toMatch(/#3 c/)
  })

  it("rejects an empty chain with a setup hint", async () => {
    await expect(runChain([], vi.fn())).rejects.toThrow(/Chưa cấu hình/)
  })

  it("stops at once on an input error (no model can fix bad input)", async () => {
    const attempt = vi.fn().mockRejectedValue(new AiError("JD quá ngắn", "input"))
    await expect(runChain(entries, attempt)).rejects.toThrow("JD quá ngắn")
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it("treats unknown errors as retryable", async () => {
    const attempt = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok")
    await expect(runChain(entries, attempt)).resolves.toMatchObject({ index: 1 })
  })
})
