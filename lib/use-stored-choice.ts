"use client"

import { useCallback, useSyncExternalStore } from "react"

const EVENT = "jt:stored-choice"

/**
 * A small per-device preference kept in localStorage (e.g. Kanban vs table).
 * Renders `fallback` on the server and first paint, then the stored value.
 */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange)
      window.addEventListener(EVENT, onChange)
      return () => {
        window.removeEventListener("storage", onChange)
        window.removeEventListener(EVENT, onChange)
      }
    },
    () => {
      try {
        const v = localStorage.getItem(key)
        return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
      } catch {
        return fallback
      }
    },
    () => fallback,
  )
  const set = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, v)
      } catch {}
      window.dispatchEvent(new Event(EVENT))
    },
    [key],
  )
  return [value, set] as const
}
