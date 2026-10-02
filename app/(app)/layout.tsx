import { Suspense } from "react"
import { BottomNav, SideNav } from "@/components/nav/app-nav"
import { TopProgress } from "@/components/nav/top-progress"
import { ensureSetup, getCurrentWorkspace, getWorkspaces } from "@/lib/data/queries"
import { requireUser } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser()
  await ensureSetup()
  const [workspaces, current] = await Promise.all([getWorkspaces(), getCurrentWorkspace()])
  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <TopProgress />
      </Suspense>
      <SideNav email={user.email ?? ""} workspaces={workspaces} current={current} />
      <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</main>
      <BottomNav />
    </div>
  )
}
