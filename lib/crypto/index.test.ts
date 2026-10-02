import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret, maskKey } from "."

const secret = randomBytes(32).toString("base64")

describe("secret encryption", () => {
  it("round-trips", () => {
    const enc = encryptSecret("sk-or-v1-abc", secret)
    expect(enc).not.toContain("sk-or")
    expect(decryptSecret(enc, secret)).toBe("sk-or-v1-abc")
  })

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("x", secret)).not.toBe(encryptSecret("x", secret))
  })

  it("fails with the wrong secret", () => {
    const enc = encryptSecret("x", secret)
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow()
  })

  it("rejects a secret that is not 32 bytes", () => {
    expect(() => encryptSecret("x", "c2hvcnQ=")).toThrow(/32 bytes/)
  })
})

describe("maskKey", () => {
  it("shows only the last 4 chars", () => {
    expect(maskKey("sk-or-v1-1234")).toBe("••••1234")
    expect(maskKey("ab")).toBe("••••")
  })
})
