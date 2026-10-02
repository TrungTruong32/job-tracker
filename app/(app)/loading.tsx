import { ProgressHold } from "@/components/nav/top-progress"
import { Skeleton } from "@/components/ui/skeleton"

// Shown instantly while a page's data loads.
export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6" aria-busy="true" aria-label="Đang tải">
      <ProgressHold />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-2xl bg-muted/50 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
