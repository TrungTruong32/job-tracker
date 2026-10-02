import { describe, expect, it } from "vitest"
import { AiParseError, CvFitSchema, JdSummarySchema, extractJson, parseWith } from "./parse"

describe("extractJson", () => {
  it("reads plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it("strips a ```json fence", () => {
    expect(extractJson('```json\n{"a": 2}\n```')).toEqual({ a: 2 })
  })

  it("finds the first balanced object inside chatter", () => {
    expect(extractJson('Sure! Here it is: {"a": {"b": "}"}} hope this helps {"x":1}')).toEqual({ a: { b: "}" } })
  })

  it("throws AiParseError when there is no object", () => {
    expect(() => extractJson("no json here")).toThrow(AiParseError)
  })

  it("throws AiParseError on broken JSON", () => {
    expect(() => extractJson('{"a": 1,,}')).toThrow(AiParseError)
  })
})

describe("schemas", () => {
  it("fills missing arrays in a JD summary with []", () => {
    const r = parseWith(JdSummarySchema, '{"company":"Acme","position":"AI Engineer","summary":"x"}')
    expect(r.required_skills).toEqual([])
    expect(r.nice_to_have).toEqual([])
  })

  it("turns null optional fields into undefined-safe values", () => {
    const r = parseWith(JdSummarySchema, '{"company":"A","position":"B","salary":null,"summary":"s","required_skills":["Python"]}')
    expect(r.salary).toBeNull()
    expect(r.required_skills).toEqual(["Python"])
  })

  it("coerces a string score and clamps to 0-100", () => {
    expect(parseWith(CvFitSchema, '{"score":"85"}').score).toBe(85)
    expect(parseWith(CvFitSchema, '{"score":120}').score).toBe(100)
    expect(parseWith(CvFitSchema, '{"score":-3}').score).toBe(0)
  })

  it("rejects a fit without a numeric score", () => {
    expect(() => parseWith(CvFitSchema, '{"score":"high"}')).toThrow(AiParseError)
  })
})
