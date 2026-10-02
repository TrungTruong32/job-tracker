import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// AES-256-GCM. Stored as base64("iv(12) | tag(16) | ciphertext").

function keyFrom(secretB64: string): Buffer {
  const key = Buffer.from(secretB64, "base64")
  if (key.length !== 32) throw new Error("AI_KEY_SECRET must be 32 bytes, base64-encoded")
  return key
}

export function encryptSecret(plain: string, secretB64: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secretB64), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")
}

export function decryptSecret(stored: string, secretB64: string): string {
  const raw = Buffer.from(stored, "base64")
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secretB64), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
}

export function maskKey(plain: string): string {
  return "••••" + (plain.length > 4 ? plain.slice(-4) : "")
}
