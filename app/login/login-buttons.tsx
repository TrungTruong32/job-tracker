"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export function LoginButtons({ devLogin }: { devLogin: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function google() {
    setLoading(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    }
  }

  async function dev(form: FormData) {
    setLoading(true)
    const supabase = createClient()
    const email = String(form.get("email"))
    const password = String(form.get("password"))
    let { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) ({ error } = await supabase.auth.signUp({ email, password }))
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Button className="h-11 w-full text-base" onClick={google} disabled={loading}>
        <GoogleIcon /> Đăng nhập bằng Google
      </Button>
      {devLogin && (
        <form action={dev} className="space-y-3 border-t pt-4" data-testid="dev-login">
          <p className="text-xs text-muted-foreground">Đăng nhập dev (chỉ môi trường local)</p>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue="dev@local.test" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" name="password" type="password" defaultValue="devpassword" required />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={loading}>
            Đăng nhập dev
          </Button>
        </form>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
