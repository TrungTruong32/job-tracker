"use client"

import { useCallback, useSyncExternalStore } from "react"

// Minimal theme switcher. The class is set before paint by THEME_SCRIPT (root layout);
// this hook only reads/toggles it. Stored choice: localStorage "theme" = "light" | "dark",
// absent = follow the OS.

const KEY = "theme"

export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

function subscribe(onChange: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)")
  const onSystem = () => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(KEY)
    } catch {}
    if (!stored) apply(mq.matches)
  }
  mq.addEventListener("change", onSystem)
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => {
    mq.removeEventListener("change", onSystem)
    obs.disconnect()
  }
}

export function useTheme() {
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => undefined,
  )
  const setTheme = useCallback((theme: "light" | "dark") => {
    try {
      localStorage.setItem(KEY, theme)
    } catch {}
    apply(theme === "dark")
  }, [])
  return { resolvedTheme, theme: resolvedTheme, setTheme }
}
