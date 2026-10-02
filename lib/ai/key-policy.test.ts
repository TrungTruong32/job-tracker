import { describe, expect, it } from "vitest"
import { nextKeyAction } from "./key-policy"

describe("nextKeyAction", () => {
  const stored = { ai_base_url: "https://openrouter.ai/api/v1", has_key: true }

  it("keeps the key when nothing about the endpoint changed", () => {
    expect(nextKeyAction(stored, { baseUrl: "https://openrouter.ai/api/v1", apiKey: undefined })).toBe("keep")
  })

  it("replaces the key when a new one is typed", () => {
    expect(nextKeyAction(stored, { baseUrl: "https://x.test/v1", apiKey: "sk-new" })).toBe("replace")
  })

  it("removes the key when asked", () => {
    expect(nextKeyAction(stored, { baseUrl: stored.ai_base_url, apiKey: "" })).toBe("remove")
  })

  it("drops the stored key when the base URL changes without a new key", () => {
    expect(nextKeyAction(stored, { baseUrl: "https://evil.example/v1", apiKey: undefined })).toBe("remove")
  })

  it("ignores trailing slashes when comparing URLs", () => {
    expect(nextKeyAction(stored, { baseUrl: "https://openrouter.ai/api/v1/", apiKey: undefined })).toBe("keep")
  })
})
