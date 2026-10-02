"use client"

import { LogOut } from "lucide-react"
import { ThemeToggle, useSignOut } from "@/components/nav/app-nav"
import { Button } from "@/components/ui/button"

export function AccountCard({ email }: { email: string }) {
  const signOut = useSignOut()
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Tài khoản</h2>
      <p className="text-sm">
        Đăng nhập với <span className="font-medium">{email}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <ThemeToggle className="inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm sm:hidden" />
        <Button variant="outline" onClick={signOut}>
          <LogOut /> Đăng xuất
        </Button>
      </div>
    </section>
  )
}
