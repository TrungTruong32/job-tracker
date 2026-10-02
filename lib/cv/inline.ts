// Light inline markup for CV text: **bold**, *italic*, [text](https://url).
// Anything that doesn't form a clean pair stays literal ("2*3", "**unclosed").

export type Run = { text: string; bold?: boolean; italic?: boolean; href?: string }
type Style = Omit<Run, "text">

const LINK = /^\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/
const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)

function parse(s: string, style: Style, out: Run[]) {
  let buf = ""
  const flush = () => {
    if (buf) out.push({ text: buf, ...style })
    buf = ""
  }
  let i = 0
  while (i < s.length) {
    if (s.startsWith("**", i)) {
      const end = s.indexOf("**", i + 2)
      if (end > i + 2) {
        flush()
        parse(s.slice(i + 2, end), { ...style, bold: true }, out)
        i = end + 2
        continue
      }
      buf += "**"
      i += 2
      continue
    }
    if (s[i] === "*" && !isWord(s[i - 1]) && s[i + 1] && s[i + 1] !== " " && s[i + 1] !== "*") {
      let end = -1
      for (let j = i + 2; j < s.length; j++) {
        if (s[j] === "*" && s[j - 1] !== " " && s[j + 1] !== "*" && !isWord(s[j + 1])) {
          end = j
          break
        }
      }
      if (end > 0) {
        flush()
        parse(s.slice(i + 1, end), { ...style, italic: true }, out)
        i = end + 1
        continue
      }
    }
    if (s[i] === "[") {
      const m = LINK.exec(s.slice(i))
      if (m) {
        flush()
        parse(m[1], { ...style, href: m[2] }, out)
        i += m[0].length
        continue
      }
    }
    buf += s[i]
    i++
  }
  flush()
}

const sameStyle = (a: Run, b: Run) => !!a.bold === !!b.bold && !!a.italic === !!b.italic && a.href === b.href

export function parseInline(s: string): Run[] {
  const raw: Run[] = []
  parse(s, {}, raw)
  const out: Run[] = []
  for (const r of raw) {
    const last = out[out.length - 1]
    if (last && sameStyle(last, r)) last.text += r.text
    else out.push(Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined && v !== false)) as Run)
  }
  return out
}

export function plainText(s: string): string {
  return parseInline(s)
    .map((r) => r.text)
    .join("")
}
