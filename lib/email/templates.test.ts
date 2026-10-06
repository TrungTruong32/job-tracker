import { describe, expect, it } from "vitest"
import { buildEmailMessages } from "@/lib/ai/prompts"
import { AI_TASKS } from "@/lib/ai/tasks"
import { parseTemplates, templatesFor } from "./draft"

const vi = { subject: "[Ứng tuyển] {Vị trí} - An", body: "Kính gửi anh/chị,\n\nEm xin ứng tuyển **{Vị trí}**.\n\nTrân trọng,\nAn" }
const en = { subject: "Application for {Position}", body: "Dear team,\n\nI am applying for {Position}.\n\nBest,\nAn" }

describe("parseTemplates", () => {
  it("keeps valid templates per language and drops junk or empty ones", () => {
    expect(parseTemplates({ vi, en: { subject: "x", body: "  " }, fr: en })).toEqual({ vi })
    expect(parseTemplates(null)).toEqual({})
    expect(parseTemplates({ vi: { body: 3 } })).toEqual({})
  })

  it("normalizes Windows line breaks", () => {
    expect(parseTemplates({ en: { subject: "s", body: "a\r\nb" } }).en?.body).toBe("a\nb")
  })
})

describe("templatesFor", () => {
  it("returns the template of the chosen language only", () => {
    expect(templatesFor({ vi, en }, "en")).toEqual([{ language: "en", ...en }])
    expect(templatesFor({ vi }, "en")).toEqual([])
  })

  it("returns every saved template for auto (JD language)", () => {
    expect(templatesFor({ vi, en }, "auto").map((t) => t.language)).toEqual(["vi", "en"])
  })
})

describe("write_email prompt", () => {
  const base = {
    jdText: "x".repeat(40),
    cvText: "y".repeat(60),
    company: "ABC",
    position: "Data Engineer",
    sender: { full_name: "An" },
    jdEmails: [],
    language: "auto" as const,
  }

  it("asks the model to follow the sample email when one is given", () => {
    const [sys, user] = buildEmailMessages({ ...base, templates: [{ language: "vi", ...vi }] })
    expect(sys.content).toContain("candidate's own sample emails")
    expect(JSON.parse(user.content).templates[0].subject).toBe(vi.subject)
  })

  it("tells the model to pick by language when several are given", () => {
    const [sys] = buildEmailMessages({ ...base, templates: templatesFor({ vi, en }, "auto") })
    expect(sys.content).toContain('matches the email language')
  })

  it("leaves the prompt unchanged without templates", () => {
    const [sys, user] = buildEmailMessages(base)
    expect(sys.content).not.toContain("sample emails")
    expect(JSON.parse(user.content)).not.toHaveProperty("templates")
  })

  it("accepts templates in the task input", () => {
    expect(AI_TASKS.write_email.input.safeParse({ ...base, templates: templatesFor({ vi, en }, "auto") }).success).toBe(true)
  })
})
