"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { NativeSelect } from "@/components/ui/native-select"
import { finishNavigation, startNavigation } from "@/components/nav/top-progress"
import { switchWorkspace } from "@/lib/data/actions"
import type { WorkspaceLite } from "@/lib/workspace/pick"

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  className,
}: {
  workspaces: WorkspaceLite[]
  currentId: string
  className?: string
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  // switching may stay on the same URL ("/"), so end the bar when the refresh settles
  useEffect(() => {
    if (!pending) finishNavigation()
  }, [pending])
  if (workspaces.length < 2) return null
  return (
    <NativeSelect
      aria-label="Chọn workspace"
      className={className}
      value={currentId}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value
        startNavigation()
        startTransition(async () => {
          const res = await switchWorkspace(id)
          if (!res.ok) return void toast.error(res.error)
          router.push("/")
          router.refresh()
        })
      }}
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
          {w.role === "owner" ? "" : " (được mời)"}
        </option>
      ))}
    </NativeSelect>
  )
}
