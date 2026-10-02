// Turn LaTeX CV source into readable plain text for the AI. Not a full parser —
// just enough to drop layout noise and keep the words.

// Commands whose arguments are layout/config, not content: drop them entirely.
const DROP_WITH_ARGS = new Set([
  "vspace", "hspace", "setlength", "addtolength", "usepackage", "documentclass", "newcommand",
  "renewcommand", "pagestyle", "thispagestyle", "geometry", "titleformat", "titlespacing",
  "definecolor", "color", "fontsize", "label", "includegraphics", "setlist", "linespread",
  "def", "hypersetup", "providecommand", "newenvironment", "renewenvironment", "setcounter",
  "addtocounter", "input", "include", "pdfgentounicode", "urlstyle", "raggedright", "raggedbottom",
])

// Environments whose opening takes layout arguments (widths, column specs) rather than content.
const LAYOUT_ENVS = new Set(["tabular", "tabular*", "tabularx", "longtable", "minipage", "multicols", "array"])

const SECTION = new Set(["section", "section*", "subsection", "subsection*", "cvsection", "resumeSection"])

const unescapeUrl = (u: string) => u.replace(/\\([_#%&$~])/g, "$1")

/** Read a balanced {...} group starting at s[i] === "{"; returns [content, indexAfter]. */
function readGroup(s: string, i: number): [string, number] {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") {
      j++
      continue
    }
    if (s[j] === "{") depth++
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1]
  }
  return [s.slice(i + 1), s.length]
}

/** Skip optional [..] args and whitespace before a group. */
function skipOptional(s: string, i: number): number {
  while (i < s.length) {
    if (s[i] === "[") {
      const end = s.indexOf("]", i)
      i = end < 0 ? s.length : end + 1
    } else if (s[i] === " " && s[i + 1] === "{") i++
    else break
  }
  return i
}

function convert(s: string): string {
  let out = ""
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === "%") {
      while (i < s.length && s[i] !== "\n") i++
      // drop the trailing spaces before a comment
      out = out.replace(/[ \t]+$/, "")
      continue
    }
    if (c === "{" || c === "}") {
      i++
      continue
    }
    if (c === "&") {
      // table column separator
      out += " "
      i++
      continue
    }
    if (c === "~") {
      out += " "
      i++
      continue
    }
    if (c !== "\\") {
      out += c
      i++
      continue
    }
    // backslash
    const next = s[i + 1] ?? ""
    if (next === "\\") {
      // line break: swallow the source newline that usually follows
      out += "\n"
      i = skipOptional(s, i + 2) // \\[4pt]
      while (s[i] === " " || s[i] === "\t") i++
      if (s[i] === "\r") i++
      if (s[i] === "\n") i++
      continue
    }
    if (/[%&$#_{}]/.test(next)) {
      out += next
      i += 2
      continue
    }
    const m = /^[a-zA-Z]+\*?/.exec(s.slice(i + 1))
    if (!m) {
      i += 2
      continue
    }
    const name = m[0]
    i += 1 + name.length
    const base = name.replace(/\*$/, "")

    if (base === "begin" || base === "end") {
      i = skipOptional(s, i)
      let env = ""
      if (s[i] === "{") [env, i] = readGroup(s, i)
      if (base === "begin" && LAYOUT_ENVS.has(env)) {
        i = skipOptional(s, i)
        while (s[i] === "{") i = skipOptional(s, readGroup(s, i)[1])
      }
      // an environment marker on its own line shouldn't leave a blank line
      if (out === "" || out.endsWith("\n")) {
        let k = i
        while (s[k] === " " || s[k] === "\t" || s[k] === "\r") k++
        if (s[k] === "\n") i = k + 1
      }
      continue
    }
    if (name === "item") {
      i = skipOptional(s, i)
      out = out.replace(/[ \t]*$/, "")
      if (out && !out.endsWith("\n")) out += "\n"
      out += "- "
      while (s[i] === " ") i++
      continue
    }
    if (base === "href") {
      i = skipOptional(s, i)
      let url = ""
      let text = ""
      if (s[i] === "{") [url, i] = readGroup(s, i)
      i = skipOptional(s, i)
      if (s[i] === "{") [text, i] = readGroup(s, i)
      url = unescapeUrl(url)
      const t = convert(text).trim()
      out += t && t !== url ? `${t} (${url})` : url
      continue
    }
    if (base === "url") {
      if (s[i] === "{") {
        const [url, j] = readGroup(s, i)
        out += unescapeUrl(url)
        i = j
      }
      continue
    }
    if (SECTION.has(name) || SECTION.has(base)) {
      i = skipOptional(s, i)
      if (s[i] === "{") {
        const [title, j] = readGroup(s, i)
        out = out.replace(/[ \t]*$/, "")
        if (out && !out.endsWith("\n")) out += "\n"
        out += `## ${convert(title).trim()}`
        i = j
        while (s[i] === " " || s[i] === "\t") i++
        if (s[i] !== "\n" && s[i] !== "\r") out += "\n"
      }
      continue
    }
    if (DROP_WITH_ARGS.has(base)) {
      // \newcommand\name[1]{...} / \def\name#1{...}: skip the macro name and parameters too
      const macro = /^\\[a-zA-Z@]+/.exec(s.slice(i))
      if (macro) i += macro[0].length
      while (s[i] === "#" && /\d/.test(s[i + 1] ?? "")) i += 2
      i = skipOptional(s, i)
      while (s[i] === "{") {
        i = readGroup(s, i)[1]
        i = skipOptional(s, i)
      }
      continue
    }
    // Any other command: drop the name, keep the content of its arguments
    // (separated by spaces so multi-arg macros stay readable).
    i = skipOptional(s, i)
    const parts: string[] = []
    while (s[i] === "{") {
      const [arg, j] = readGroup(s, i)
      parts.push(convert(arg))
      i = j
    }
    if (parts.length) out += parts.filter((p) => p.trim()).join(" ")
    else if (s[i] === " " && /\S$/.test(out)) out += " " // "\hfill B" -> " B" keeps words apart
  }
  return out
}

export function stripLatex(src: string): string {
  const begin = src.indexOf("\\begin{document}")
  let body = begin >= 0 ? src.slice(begin + "\\begin{document}".length) : src
  const end = body.indexOf("\\end{document}")
  if (end >= 0) body = body.slice(0, end)

  return convert(body)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
