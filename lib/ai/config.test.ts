import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import { encryptSecret } from "@/lib/crypto"
import { resolveAiConfig } from "./config"

const secret = randomBytes(32).toString("base64")
const base = { ai_provider: "openrouter", ai_base_url: "https://openrouter.ai/api/v1", ai_model: "m", ai_api_key_encrypted: null as string | null }

describe("resolveAiConfig", () => {
  it("returns null when settings are missing", () => {
    expect(resolveAiConfig(null, secret)).toBeNull()
  })

  it("returns null when model or base URL is empty", () => {
    expect(resolveAiConfig({ ...base, ai_model: " " }, secret)).toBeNull()
    expect(resolveAiConfig({ ...base, ai_base_url: null }, secret)).toBeNull()
  })

  it("returns null for a hosted provider without a key", () => {
    expect(resolveAiConfig(base, secret)).toBeNull()
  })

  it("decrypts the key for hosted providers", () => {
    const cfg = resolveAiConfig({ ...base, ai_api_key_encrypted: encryptSecret("sk-1", secret) }, secret)
    expect(cfg).toEqual({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-1", model: "m" })
  })

  it("allows ollama without a key", () => {
    expect(resolveAiConfig({ ...base, ai_provider: "ollama" }, secret)).toEqual({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: null,
      model: "m",
    })
  })

  it("treats an undecryptable key as missing", () => {
    expect(resolveAiConfig({ ...base, ai_api_key_encrypted: "garbage" }, secret)).toBeNull()
  })
})
