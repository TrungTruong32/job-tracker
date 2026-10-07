import { cn } from "@/lib/utils"

// Trung Trương logo mark, copied from the brand kit: the on-light file in light mode, on-dark in dark mode.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, nothing to optimize */}
      <img src="/brand/mark-on-light.svg" alt="" className="size-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, nothing to optimize */}
      <img src="/brand/mark-on-dark.svg" alt="" className="hidden size-full dark:block" />
    </span>
  )
}
