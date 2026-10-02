import { BottomNav, SideNav } from "@/components/nav/app-nav"
import { ensureSetup } from "@/lib/data/queries"
import { requireUser } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser()
  await ensureSetup()
  return (
    <div className="flex min-h-dvh">
      <SideNav email={user.email ?? ""} />
      <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</main>
      <BottomNav />
    </div>
  )
}
