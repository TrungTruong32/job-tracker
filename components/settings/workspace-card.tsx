"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Crown, Loader2, LogOut, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { startNavigation } from "@/components/nav/top-progress"
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inviteMember, leaveWorkspace, removeMember, renameWorkspace } from "@/lib/data/actions"
import type { Member } from "@/lib/data/types"
import type { WorkspaceLite } from "@/lib/workspace/pick"

export function WorkspaceCard({
  current,
  workspaces,
  members,
}: {
  current: WorkspaceLite
  workspaces: WorkspaceLite[]
  members: Member[]
}) {
  const isOwner = current.role === "owner"
  const [name, setName] = useState(current.name)
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) return void toast.error(res.error)
      toast.success(success)
      after?.()
    })

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="ws-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ws-title" className="font-semibold">
          Workspace
        </h2>
        <WorkspaceSwitcher workspaces={workspaces} currentId={current.id} className="w-full sm:w-64" />
      </div>

      {isOwner ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => renameWorkspace(name), "Đã đổi tên workspace")
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="ws-name">Tên workspace</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" size="lg" disabled={pending || name.trim() === current.name}>
            Lưu tên
          </Button>
        </form>
      ) : (
        <p className="text-sm">
          Bạn là <span className="font-medium">thành viên</span> của “{current.name}”. Bạn xem và sửa được dữ liệu; cài đặt AI và thành viên do
          chủ workspace quản lý.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Thành viên ({members.length})</h3>
        <ul className="divide-y rounded-lg border" data-testid="members">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{m.email}</span>
              {m.role === "owner" ? (
                <Badge variant="secondary">
                  <Crown /> Chủ
                </Badge>
              ) : !m.joined ? (
                <Badge variant="outline">Đang chờ</Badge>
              ) : null}
              {isOwner && m.role === "member" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Xoá ${m.email}`}
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Xoá ${m.email} khỏi workspace? Người này sẽ mất quyền truy cập ngay.`))
                      run(() => removeMember(m.id), "Đã xoá thành viên")
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isOwner ? (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => inviteMember(email), "Đã mời. Người được mời chỉ cần đăng nhập Google bằng email này.", () => setEmail(""))
          }}
        >
          <Label htmlFor="invite-email">Mời thành viên</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="email@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Mời
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Người được mời đăng nhập bằng Google đúng email này là thấy dữ liệu của workspace.</p>
        </form>
      ) : (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm(`Rời workspace “${current.name}”?`))
              run(() => leaveWorkspace(), "Đã rời workspace", () => {
                startNavigation()
                router.push("/")
                router.refresh()
              })
          }}
        >
          <LogOut /> Rời workspace
        </Button>
      )}
    </section>
  )
}
