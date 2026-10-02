import { describe, expect, it } from "vitest"
import type { AppLite } from "@/lib/domain"
import { filterApps, normalize, sortApps } from "./filter"

type A = AppLite & { jd_text: string | null; location: string | null }
const mk = (over: Partial<A>): A => ({
  id: "x",
  company: "Acme",
  position: "AI Engineer",
  stage_id: "s0",
  source: "LinkedIn",
  cv_version_id: null,
  applied_at: "2026-10-01",
  last_activity_at: "2026-10-01T00:00:00Z",
  next_action: null,
  next_action_due: null,
  jd_text: null,
  location: null,
  ...over,
})

const apps = [
  mk({ id: "1", company: "FPT Smart Cloud", position: "Kỹ sư AI", applied_at: "2026-09-01", jd_text: "LangChain, RAG" }),
  mk({ id: "2", company: "VNG", position: "ML Engineer", source: "TopCV", stage_id: "s1", applied_at: "2026-09-20" }),
  mk({ id: "3", company: "MoMo", position: "LLM Engineer", cv_version_id: "cv2", applied_at: "2026-10-01" }),
]

describe("normalize", () => {
  it("strips Vietnamese diacritics and case", () => {
    expect(normalize("Kỹ Sư Đường")).toBe("ky su duong")
  })
})

describe("filterApps", () => {
  it("returns everything with empty filters", () => {
    expect(filterApps(apps, {})).toHaveLength(3)
  })

  it("searches company, position and JD without accents", () => {
    expect(filterApps(apps, { q: "ky su" }).map((a) => a.id)).toEqual(["1"])
    expect(filterApps(apps, { q: "rag" }).map((a) => a.id)).toEqual(["1"])
    expect(filterApps(apps, { q: "vng" }).map((a) => a.id)).toEqual(["2"])
  })

  it("filters by stage, source, cv and date range together", () => {
    expect(filterApps(apps, { stageId: "s1" }).map((a) => a.id)).toEqual(["2"])
    expect(filterApps(apps, { source: "LinkedIn" }).map((a) => a.id)).toEqual(["1", "3"])
    expect(filterApps(apps, { cvId: "cv2" }).map((a) => a.id)).toEqual(["3"])
    expect(filterApps(apps, { from: "2026-09-15", to: "2026-09-30" }).map((a) => a.id)).toEqual(["2"])
  })
})

describe("sortApps", () => {
  it("sorts by date desc and by company asc", () => {
    expect(sortApps(apps, "applied_at", "desc").map((a) => a.id)).toEqual(["3", "2", "1"])
    expect(sortApps(apps, "company", "asc").map((a) => a.id)).toEqual(["1", "3", "2"])
  })
})
