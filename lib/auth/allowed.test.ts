import { describe, expect, it } from "vitest"
import { canSignIn, isAllowedEmail, parseAllowedEmails } from "./allowed"

describe("allowed emails", () => {
  const allowed = parseAllowedEmails(" Me@Gmail.com, other@x.dev ;third@y.io")

  it("matches case-insensitively", () => {
    expect(isAllowedEmail("me@gmail.com", allowed)).toBe(true)
    expect(isAllowedEmail("OTHER@x.dev", allowed)).toBe(true)
    expect(isAllowedEmail("third@y.io", allowed)).toBe(true)
  })

  it("rejects unknown or missing emails", () => {
    expect(isAllowedEmail("evil@gmail.com", allowed)).toBe(false)
    expect(isAllowedEmail(null, allowed)).toBe(false)
  })

  it("denies everyone when the list is empty", () => {
    expect(isAllowedEmail("me@gmail.com", parseAllowedEmails(undefined))).toBe(false)
    expect(isAllowedEmail("me@gmail.com", parseAllowedEmails(""))).toBe(false)
  })
})


describe("canSignIn", () => {
  const allowed = parseAllowedEmails("me@gmail.com")
  const google = (email: string) => ({ email, app_metadata: { provider: "google" } })
  const never = async () => {
    throw new Error("should not query")
  }

  it("lets allowlisted users in without a DB lookup and marks them owners", async () => {
    await expect(canSignIn(google("me@gmail.com"), allowed, false, never)).resolves.toEqual({ ok: true, personal: true })
  })

  it("lets invited users in without a personal workspace", async () => {
    await expect(canSignIn(google("friend@gmail.com"), allowed, false, async () => true)).resolves.toEqual({ ok: true, personal: false })
  })

  it("rejects users who are neither allowlisted nor invited", async () => {
    await expect(canSignIn(google("x@gmail.com"), allowed, false, async () => false)).resolves.toEqual({ ok: false, personal: false })
  })

  it("rejects non-Google sign-ins in production even when invited", async () => {
    const pw = { email: "friend@gmail.com", app_metadata: { provider: "email" } }
    await expect(canSignIn(pw, allowed, false, async () => true)).resolves.toEqual({ ok: false, personal: false })
  })
})
