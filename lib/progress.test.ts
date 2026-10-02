import { describe, expect, it, vi } from "vitest"
import { createProgressStore } from "./progress"

describe("progress store", () => {
  it("starts on navigation and finishes when the route changes", () => {
    const s = createProgressStore()
    const seen = vi.fn()
    s.subscribe(seen)
    s.start()
    expect(s.get()).toBe(true)
    s.routeChanged()
    expect(s.get()).toBe(false)
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it("keeps running while a loading screen holds it, even after the URL changed", () => {
    const s = createProgressStore()
    s.start()
    const release = s.hold()
    s.routeChanged()
    expect(s.get()).toBe(true)
    release()
    expect(s.get()).toBe(false)
  })

  it("a hold alone also shows progress", () => {
    const s = createProgressStore()
    const release = s.hold()
    expect(s.get()).toBe(true)
    release()
    release() // idempotent
    expect(s.get()).toBe(false)
  })

  it("does not notify when nothing changes", () => {
    const s = createProgressStore()
    const seen = vi.fn()
    s.subscribe(seen)
    s.routeChanged()
    expect(seen).not.toHaveBeenCalled()
  })
})
