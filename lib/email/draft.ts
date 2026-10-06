import { z } from "zod"

/**
 * Application email drafts. The body is a tiny markup so it survives a textarea and
 * the clipboard: blank line = new paragraph, newline = line break, "- " = bullet,
 * **text** = bold, URLs/emails become links.
 */

const str = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n") : ""), z.string().max(max))

export const EmailDraftSchema = z.object({
  to: str(500),
  subject: str(300),
  body: str(20_000),
  /** the subject follows a format the JD asked for */
  subject_from_jd: z.boolean().default(false),
  /** when the AI last wrote it; null for a hand-written draft */
  generated_at: z.string().nullable().default(null),
  /** user changed it after the AI wrote it (regenerate asks first) */
  edited: z.boolean().default(false),
  updated_at: z.string(),
})
export type EmailDraft = z.infer<typeof EmailDraftSchema>

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

/** Email addresses written in a text (e.g. "gửi CV về hr@abc.vn"), lowercased, deduped, in order. */
export function findEmails(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].replace(/\.+$/, "").toLowerCase()
    if (!out.includes(e)) out.push(e)
  }
  return out
}

/** Keep only the addresses that really appear in the JD (models like to invent hr@company.com). */
export function keepKnownEmails(to: string | null | undefined, known: string[]): string {
  if (!to) return ""
  return findEmails(to)
    .filter((e) => known.includes(e))
    .join(", ")
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const LINK_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi

/** One line of markup -> inline HTML (escaped first, so pasted/AI text can't inject tags). */
function inlineHtml(line: string): string {
  return line
    .split(/(\*\*[^*\n]+?\*\*)/g)
    .map((part) => {
      const bold = /^\*\*([^*\n]+?)\*\*$/.exec(part)
      const text = bold ? bold[1] : part
      const html = escapeHtml(text).replace(LINK_RE, (m, url: string | undefined) =>
        url ? `<a href="${m}">${m}</a>` : `<a href="mailto:${m}">${m}</a>`,
      )
      return bold ? `<b>${html}</b>` : html
    })
    .join("")
}

const BULLET_RE = /^\s*(?:[-*•])\s+/

/**
 * Body markup -> HTML shaped like Gmail's own compose output (one <div> per line,
 * <div><br></div> for blank lines, no fonts) so a paste takes the user's Gmail style.
 */
export function bodyToHtml(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").replace(/\s+$/, "").split("\n")
  const out: string[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`)
    bullets = []
  }
  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      bullets.push(inlineHtml(line.replace(BULLET_RE, "")))
      continue
    }
    flush()
    out.push(line.trim() ? `<div>${inlineHtml(line)}</div>` : "<div><br></div>")
  }
  flush()
  return out.join("")
}

/** Body markup -> plain text for clients that ignore HTML (bold markers dropped, bullets kept). */
export function bodyToText(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(BULLET_RE, "• ").replace(/\*\*([^*\n]+?)\*\*/g, "$1"))
    .join("\n")
    .trim()
}

/** Gmail compose link with To/Subject prefilled (body goes through the clipboard: the URL is plain text only). */
export function gmailComposeUrl(d: Pick<EmailDraft, "to" | "subject">): string {
  const p = new URLSearchParams({ view: "cm", fs: "1" })
  if (d.to.trim()) p.set("to", d.to.trim())
  if (d.subject.trim()) p.set("su", d.subject.trim())
  return `https://mail.google.com/mail/?${p.toString()}`
}

/** Pasted HTML (Gmail, Word, a web page) -> body markup, keeping bold, line breaks and bullets. */
export function htmlToBody(html: string): string {
  // DOMParser builds an inert document: no scripts run and <img onerror> never loads
  const root = new DOMParser().parseFromString(html, "text/html").body
  const out: string[] = []
  let line = ""
  const breakLine = () => {
    out.push(line)
    line = ""
  }
  const walk = (node: Node, bold: boolean) => {
    if (node.nodeType === 3) {
      line += (node.textContent ?? "").replace(/\s+/g, " ")
      return
    }
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (["script", "style", "head", "title", "meta"].includes(tag)) return
    if (tag === "br") return breakLine()
    // an explicit weight wins over the tag: Google Docs wraps everything in <b style="font-weight:normal">
    const weight = el.style?.fontWeight
    const heavy = weight ? weight === "bold" || weight === "bolder" || Number(weight) >= 600 : tag === "b" || tag === "strong"
    const isBold = !bold && heavy
    const block = ["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "ul", "ol"].includes(tag)
    if (block && line.trim()) breakLine()
    if (tag === "li") line += "- "
    if (isBold) line += "**"
    el.childNodes.forEach((c) => walk(c, bold || isBold))
    if (isBold) line = line.endsWith("**") ? line.slice(0, -2) : line.replace(/(\s*)$/, "**$1")
    if (block && line.trim()) breakLine()
    // <p> paragraphs (Word, web pages) are separated by a blank line; Gmail's <div>s are not
    if (tag === "p" && out.length && out[out.length - 1] !== "") out.push("")
  }
  root.childNodes.forEach((c) => walk(c, false))
  if (line.trim()) out.push(line)
  return out
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/\*\*\s*\*\*/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
