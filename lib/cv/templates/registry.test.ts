import { describe, expect, it } from "vitest"
import { switchTemplateStyle, TEMPLATES } from "./registry"

describe("switchTemplateStyle", () => {
  it("takes the new template's defaults for settings the user never changed", () => {
    expect(switchTemplateStyle("classic", "harvard", TEMPLATES.classic.defaults)).toEqual(TEMPLATES.harvard.defaults)
  })

  it("keeps the user's own settings (clamped to the new bounds)", () => {
    const mine = { ...TEMPLATES.modern.defaults, accent: "#ff0000", date_format: "MM/YYYY" as const, margin_mm: 30, qr_url: "https://x.dev" }
    const s = switchTemplateStyle("modern", "harvard", mine)
    expect(s).toMatchObject({ accent: "#ff0000", date_format: "MM/YYYY", qr_url: "https://x.dev", show_qr: true, font_size: 10 })
    expect(s.margin_mm).toBe(TEMPLATES.harvard.bounds.margin_mm[1])
  })
})
