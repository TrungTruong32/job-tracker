"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, BriefcaseBusiness, FileText, LogOut, Moon, Settings, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/", label: "Đơn ứng tuyển", short: "Đơn", icon: BriefcaseBusiness },
  { href: "/dashboard", label: "Dashboard", short: "Thống kê", icon: BarChart3 },
  { href: "/cv", label: "CV", short: "CV", icon: FileText },
  { href: "/settings", label: "Cài đặt", short: "Cài đặt", icon: Settings },
] as const

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/applications") : pathname.startsWith(href)
}

export function useSignOut() {
  const router = useRouter()
  return async () => {
    await createClient().auth.signOut()
    router.replace("/login")
    router.refresh()
  }
}

export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={className}
      aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
    >
      <Sun className="hidden size-5 shrink-0 dark:block" />
      <Moon className="size-5 shrink-0 dark:hidden" />
      {withLabel && <span className="hidden xl:inline">{dark ? "Giao diện sáng" : "Giao diện tối"}</span>}
    </button>
  )
}

const sideItem =
  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground justify-center xl:justify-start"

export function SideNav({ email }: { email: string }) {
  const pathname = usePathname()
  const signOut = useSignOut()
  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r bg-sidebar p-2 sm:flex xl:w-56">
      <Link href="/" className="mb-4 flex h-12 items-center justify-center gap-2 px-2 xl:justify-start">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BriefcaseBusiness className="size-4" />
        </span>
        <span className="hidden font-semibold xl:inline">Job Tracker</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Tooltip key={href}>
            <TooltipTrigger
              render={
                <Link
                  href={href}
                  className={cn(sideItem, isActive(pathname, href) && "bg-muted text-foreground")}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                />
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden xl:inline">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="xl:hidden">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <div className="flex flex-col gap-1 border-t pt-2">
        <p className="hidden truncate px-3 py-1 text-xs text-muted-foreground xl:block" title={email}>
          {email}
        </p>
        <ThemeToggle className={sideItem} withLabel />
        <button type="button" onClick={signOut} className={sideItem} aria-label="Đăng xuất">
          <LogOut className="size-5 shrink-0" />
          <span className="hidden xl:inline">Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" />
                {short}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
