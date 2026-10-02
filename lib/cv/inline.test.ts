import { describe, expect, it } from "vitest"
import { parseInline, plainText } from "./inline"

describe("parseInline", () => {
  it("returns plain text as one run", () => {
    expect(parseInline("Built an ETL pipeline")).toEqual([{ text: "Built an ETL pipeline" }])
  })

  it("parses bold, italic and links", () => {
    expect(parseInline("Delivered **~120K rows** for *16 brands* — [paper](https://acm.org/x)")).toEqual([
      { text: "Delivered " },
      { text: "~120K rows", bold: true },
      { text: " for " },
      { text: "16 brands", italic: true },
      { text: " — " },
      { text: "paper", href: "https://acm.org/x" },
    ])
  })

  it("supports bold links and italic inside bold", () => {
    expect(parseInline("**[ExampleConf 2025](https://x.y) paper** *(RAG)*")).toEqual([
      { text: "ExampleConf 2025", bold: true, href: "https://x.y" },
      { text: " paper", bold: true },
      { text: " " },
      { text: "(RAG)", italic: true },
    ])
  })

  it("keeps unmatched markers and math-like stars as text", () => {
    expect(parseInline("2*3 = 6 and **unclosed")).toEqual([{ text: "2*3 = 6 and **unclosed" }])
    expect(parseInline("a [b] (c)")).toEqual([{ text: "a [b] (c)" }])
  })

  it("only links http(s) and mailto", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ text: "[x](javascript:alert(1))" }])
  })
})

describe("plainText", () => {
  it("strips markup", () => {
    expect(plainText("**Built** *fast* [site](https://a.b)")).toBe("Built fast site")
  })
})
