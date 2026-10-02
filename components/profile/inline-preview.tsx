import { parseInline } from "@/lib/cv/inline"
import { cn } from "@/lib/utils"

/** Render **bold** / *italic* / [link](url) markup as it will appear on the CV. */
export function InlinePreview({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {parseInline(text).map((r, i) => {
        const cls = cn(r.bold && "font-semibold text-foreground", r.italic && "italic", r.href && "underline")
        return (
          <span key={i} className={cls || undefined} title={r.href}>
            {r.text}
          </span>
        )
      })}
    </span>
  )
}
