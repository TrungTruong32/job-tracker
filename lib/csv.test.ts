import { describe, expect, it } from "vitest"
import { toCsv } from "./csv"

describe("toCsv", () => {
  it("writes a BOM, header and rows with CRLF", () => {
    const out = toCsv(["A", "B"], [["1", "2"]])
    expect(out).toBe("﻿A,B\r\n1,2")
  })

  it("quotes commas, quotes and newlines; empties nulls", () => {
    expect(toCsv(["x"], [['a,"b"\nc'], [null]])).toBe('﻿x\r\n"a,""b""\nc"\r\n')
  })

  it("neutralizes spreadsheet formulas", () => {
    expect(toCsv(["x"], [["=HYPERLINK(1)"]])).toBe("﻿x\r\n'=HYPERLINK(1)")
  })
})
