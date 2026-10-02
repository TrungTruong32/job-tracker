"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { progress } from "@/lib/progress"
import { cn } from "@/lib/utils"

/** Call before a programmatic router.push/replace so the bar shows immediately. */
export const startNavigation = () => progress.start()

/** End a programmatic navigation that may not change the URL (e.g. refresh in place). */
export const finishNavigation = () => progress.routeChanged()

/** Put inside loading.tsx: keeps the bar running while the skeleton is on screen. */
export function ProgressHold() {
  useEffect(() => progress.hold(), [])
  return null
}

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return false
  const url = new URL(a.href, location.href)
  if (url.origin !== location.origin) return false
  return url.pathname + url.search !== location.pathname + location.search
}

/** Thin bar at the top of the screen while a page is loading. */
export function TopProgress() {
  const active = useSyncExternalStore(progress.subscribe, progress.get, () => false)
  const [phase, setPhase] = useState<"idle" | "running" | "finishing">("idle")
  const pathname = usePathname()
  const search = useSearchParams()
  const first = useRef(true)

  // link clicks start the bar (capture phase: before Next's Link handler)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) progress.start()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  // the URL committed
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    progress.routeChanged()
  }, [pathname, search])

  // running -> finishing (fill + fade) -> idle
  const [prevActive, setPrevActive] = useState(active)
  if (prevActive !== active) {
    setPrevActive(active)
    setPhase(active ? "running" : "finishing")
  }
  useEffect(() => {
    if (phase !== "finishing") return
    const t = setTimeout(() => setPhase("idle"), 350)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === "idle") return null
  return (
    <div
      role="progressbar"
      aria-label="Đang tải trang"
      aria-busy={phase === "running"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className={cn(
          "h-full rounded-r-full bg-(--series-1) shadow-[0_0_8px_var(--series-1)]",
          phase === "running" && "animate-[top-progress_10s_cubic-bezier(.1,.7,.2,1)_forwards]",
          phase === "finishing" && "w-full opacity-0 transition-[width,opacity] duration-300",
        )}
      />
    </div>
  )
}
