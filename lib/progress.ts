/**
 * Tiny state machine behind the top progress bar.
 * - start(): a navigation began (link click, router.push)
 * - routeChanged(): the URL committed — done, unless a loading screen still holds it
 * - hold(): a loading.tsx skeleton is on screen; progress lasts until it unmounts
 */
export function createProgressStore() {
  let navigating = false
  let holds = 0
  const listeners = new Set<() => void>()
  const active = () => navigating || holds > 0

  function update(fn: () => void) {
    const before = active()
    fn()
    if (active() !== before) listeners.forEach((l) => l())
  }

  return {
    get: active,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    start: () => update(() => (navigating = true)),
    routeChanged: () => update(() => (navigating = false)),
    hold() {
      let released = false
      update(() => holds++)
      return () => {
        if (released) return
        released = true
        update(() => holds--)
      }
    },
  }
}

export const progress = createProgressStore()
