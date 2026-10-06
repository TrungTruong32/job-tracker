import { describe, expect, it } from "vitest"
import { AI_TASKS } from "@/lib/ai/tasks"
import { EmailDraftSchema, bodyToHtml, bodyToText, findEmails, gmailComposeUrl, keepKnownEmails } from "./draft"

describe("findEmails", () => {
  it("finds addresses in order, lowercased and deduped, without a trailing dot", () => {
    expect(findEmails("Gửi CV về HR@ABC.vn. Hoặc liên hệ lan.nguyen@abc.vn, hr@abc.vn")).toEqual(["hr@abc.vn", "lan.nguyen@abc.vn"])
  })
})

describe("keepKnownEmails", () => {
  it("drops addresses the JD never mentions", () => {
    expect(keepKnownEmails("hr@abc.vn, jobs@invented.com", ["hr@abc.vn"])).toBe("hr@abc.vn")
    expect(keepKnownEmails("careers@abc.com", [])).toBe("")
    expect(keepKnownEmails(null, ["hr@abc.vn"])).toBe("")
  })
})

describe("bodyToHtml", () => {
  it("renders Gmail-style lines, blank lines, bold and bullets", () => {
    const html = bodyToHtml("Kính gửi chị Lan,\n\nEm ứng tuyển **Data Engineer**:\n- **3 năm** Python\n- Airflow\n\nTrân trọng,\nAn")
    expect(html).toBe(
      "<div>Kính gửi chị Lan,</div><div><br></div><div>Em ứng tuyển <b>Data Engineer</b>:</div>" +
        "<ul><li><b>3 năm</b> Python</li><li>Airflow</li></ul><div><br></div><div>Trân trọng,</div><div>An</div>",
    )
  })

  it("escapes HTML before adding its own tags", () => {
    expect(bodyToHtml('<img src=x onerror="alert(1)"> **<b>x</b>**')).toBe(
      "<div>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <b>&lt;b&gt;x&lt;/b&gt;</b></div>",
    )
  })

  it("links URLs and email addresses", () => {
    expect(bodyToHtml("Portfolio: https://an.dev/work. Mail: an@x.io")).toBe(
      '<div>Portfolio: <a href="https://an.dev/work">https://an.dev/work</a>. Mail: <a href="mailto:an@x.io">an@x.io</a></div>',
    )
  })

  it("normalizes CRLF and trailing blank lines", () => {
    expect(bodyToHtml("a\r\nb\r\n\r\n")).toBe("<div>a</div><div>b</div>")
  })
})

describe("bodyToText", () => {
  it("drops bold markers and keeps bullets readable", () => {
    expect(bodyToText("Vị trí **Data Engineer**\n- Python\r\n* SQL")).toBe("Vị trí Data Engineer\n• Python\n• SQL")
  })
})

describe("gmailComposeUrl", () => {
  it("prefills to and subject only", () => {
    const url = new URL(gmailComposeUrl({ to: "hr@abc.vn", subject: "[DE] - Nguyễn An" }))
    expect(url.searchParams.get("view")).toBe("cm")
    expect(url.searchParams.get("to")).toBe("hr@abc.vn")
    expect(url.searchParams.get("su")).toBe("[DE] - Nguyễn An")
    expect(url.searchParams.has("body")).toBe(false)
  })
})

describe("EmailDraftSchema", () => {
  it("fills defaults and normalizes line endings", () => {
    const d = EmailDraftSchema.parse({ to: "a@b.co", subject: "s", body: "x\r\ny", updated_at: "2026-10-06T00:00:00Z" })
    expect(d).toMatchObject({ body: "x\ny", subject_from_jd: false, generated_at: null, edited: false })
  })
})

describe("write_email task output", () => {
  const out = AI_TASKS.write_email.output
  it("tolerates loose model output", () => {
    expect(out.parse({ to: " ", to_name: null, subject: " Ứng tuyển ", subject_from_jd: "true", body: " Hi " })).toEqual({
      to: null,
      to_name: null,
      subject: "Ứng tuyển",
      subject_from_jd: true,
      body: "Hi",
    })
  })
  it("builds a prompt containing the JD emails and sender", () => {
    const msgs = AI_TASKS.write_email.messages({
      jdText: "JD",
      cvText: "CV",
      company: "ABC",
      position: "DE",
      sender: { full_name: "Nguyễn An" },
      jdEmails: ["hr@abc.vn"],
      language: "vi",
    })
    expect(msgs[0].content).toContain("Vietnamese")
    expect(msgs[1].content).toContain("hr@abc.vn")
    expect(msgs[1].content).toContain("Nguyễn An")
  })
})
