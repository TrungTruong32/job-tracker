import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret } from "@/lib/crypto"
import { applyAiUpdate, publicAi, readAi, resolveEntry } from "./settings"

const secret = randomBytes(32).toString("base64")
const OR = "11111111-1111-4111-8111-111111111111"
const GM = "22222222-2222-4222-8222-222222222222"
const OL = "33333333-3333-4333-8333-333333333333"

const row = {
  ai_connections: [
    { id: OR, provider: "openrouter", base_url: "https://openrouter.ai/api/v1", key_enc: encryptSecret("sk-or-1234", secret) },
    { id: GM, provider: "gemini", base_url: "https://generativelanguage.googleapis.com/v1beta/openai", key_enc: null },
    { id: OL, provider: "ollama", base_url: "http://localhost:11434/v1", key_enc: null },
  ],
  ai_chain: [
    { connection_id: OR, model: "llama:free" },
    { connection_id: GM, model: "gemini-2.5-flash" },
    { connection_id: OL, model: "qwen2.5:7b" },
    { connection_id: "gone", model: "x" },
  ],
}

describe("readAi", () => {
  it("drops chain entries pointing at missing connections and tolerates junk", () => {
    expect(readAi(row).chain).toHaveLength(3)
    expect(readAi({ ai_connections: "nope", ai_chain: null })).toEqual({ connections: [], chain: [] })
  })
})

describe("resolveEntry", () => {
  it("decrypts the key of the entry's own connection", () => {
    expect(resolveEntry(row, 0, secret)).toEqual({ provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-or-1234", model: "llama:free" })
  })

  it("returns null for a hosted connection without a key, or a bad index", () => {
    expect(resolveEntry(row, 1, secret)).toBeNull()
    expect(resolveEntry(row, 9, secret)).toBeNull()
  })

  it("allows Ollama without a key", () => {
    expect(resolveEntry(row, 2, secret)?.apiKey).toBeNull()
  })
})

describe("publicAi", () => {
  it("never exposes keys and marks usable entries", () => {
    const p = publicAi(row, secret)
    expect(JSON.stringify(p)).not.toContain("sk-or")
    expect(p.connections[0].key_mask).toBe("••••1234")
    expect(p.chain.map((c) => c.usable)).toEqual([true, false, true])
    expect(p.ready).toBe(true)
  })
})

describe("applyAiUpdate", () => {
  const enc = (k: string) => encryptSecret(k, secret)

  it("keeps a stored key when the connection URL is unchanged", () => {
    const out = applyAiUpdate(row, { connections: [{ id: OR, provider: "openrouter", base_url: "https://openrouter.ai/api/v1/" }], chain: [] }, enc)
    expect(decryptSecret(out.ai_connections[0].key_enc!, secret)).toBe("sk-or-1234")
  })

  it("drops the key when the URL changes without a new key", () => {
    const out = applyAiUpdate(row, { connections: [{ id: OR, provider: "custom", base_url: "https://evil.example/v1" }], chain: [] }, enc)
    expect(out.ai_connections[0].key_enc).toBeNull()
  })

  it("encrypts a newly typed key and removes on empty string", () => {
    const out = applyAiUpdate(
      row,
      {
        connections: [
          { id: GM, provider: "gemini", base_url: row.ai_connections[1].base_url, api_key: "AIza-new" },
          { id: OR, provider: "openrouter", base_url: "https://openrouter.ai/api/v1", api_key: "" },
        ],
        chain: [],
      },
      enc,
    )
    expect(decryptSecret(out.ai_connections[0].key_enc!, secret)).toBe("AIza-new")
    expect(out.ai_connections[1].key_enc).toBeNull()
  })

  it("rejects chains that reference unknown connections, and enforces limits", () => {
    expect(() => applyAiUpdate(row, { connections: [], chain: [{ connection_id: OR, model: "m" }] }, enc)).toThrow(/kết nối/)
    const many = Array.from({ length: 9 }, () => ({ connection_id: OR, model: "m" }))
    expect(() =>
      applyAiUpdate(row, { connections: [{ id: OR, provider: "openrouter", base_url: "https://openrouter.ai/api/v1" }], chain: many }, enc),
    ).toThrow(/8/)
  })

  it("rejects a non-http base URL", () => {
    expect(() => applyAiUpdate(row, { connections: [{ id: OR, provider: "custom", base_url: "ftp://x" }], chain: [] }, enc)).toThrow(/Base URL/)
  })
})
