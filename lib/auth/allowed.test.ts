import { describe, expect, it } from "vitest"
import { isAllowedEmail, isAuthorizedUser, parseAllowedEmails } from "./allowed"

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

describe("isAuthorizedUser", () => {
  const allowed = parseAllowedEmails("me@gmail.com")
  const google = { email: "me@gmail.com", app_metadata: { provider: "google" } }
  const password = { email: "me@gmail.com", app_metadata: { provider: "email" } }

  it("accepts an allowlisted Google user", () => {
    expect(isAuthorizedUser(google, allowed, false)).toBe(true)
  })

  it("rejects email/password users unless dev login is on", () => {
    expect(isAuthorizedUser(password, allowed, false)).toBe(false)
    expect(isAuthorizedUser(password, allowed, true)).toBe(true)
  })

  it("rejects a Google user who is not allowlisted", () => {
    expect(isAuthorizedUser({ ...google, email: "x@gmail.com" }, allowed, false)).toBe(false)
  })

  it("rejects a missing user", () => {
    expect(isAuthorizedUser(null, allowed, true)).toBe(false)
  })
})
