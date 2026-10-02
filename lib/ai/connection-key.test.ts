import { randomBytes } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { encryptSecret } from "@/lib/crypto"
import { keyForConnection } from "./connection-key"

const secret = randomBytes(32).toString("base64")
beforeAll(() => {
  process.env.AI_KEY_SECRET = secret
})
const row = () => ({
  ai_connections: [{ id: "c1", provider: "openrouter", base_url: "https://openrouter.ai/api/v1", key_enc: encryptSecret("sk-saved", secret) }],
  ai_chain: [],
})

describe("keyForConnection", () => {
  it("prefers a freshly typed key", () => {
    expect(keyForConnection(row(), { baseUrl: "https://x.test", apiKey: " sk-typed " })).toBe("sk-typed")
  })

  it("uses the stored key for its own URL (trailing slash ignored)", () => {
    expect(keyForConnection(row(), { baseUrl: "https://openrouter.ai/api/v1/", connectionId: "c1" })).toBe("sk-saved")
  })

  it("never sends the stored key to a different URL", () => {
    expect(keyForConnection(row(), { baseUrl: "https://evil.example/v1", connectionId: "c1" })).toBeNull()
  })

  it("returns null for unknown connections", () => {
    expect(keyForConnection(row(), { baseUrl: "https://openrouter.ai/api/v1", connectionId: "nope" })).toBeNull()
  })
})
