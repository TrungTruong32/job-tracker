import type { Metadata } from "next"
import { BrandMark } from "@/components/nav/brand-mark"
import { LoginButtons } from "./login-buttons"

export const metadata: Metadata = { title: "Đăng nhập" }

const ERRORS: Record<string, string> = {
  forbidden: "Email này không có quyền truy cập ứng dụng.",
  oauth: "Đăng nhập Google không thành công, thử lại.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams
  const message = typeof error === "string" ? ERRORS[error] : undefined

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <BrandMark className="mx-auto size-12" />
          <h1 className="text-xl font-semibold">Job Tracker</h1>
          <p className="text-xs font-medium uppercase tracking-[var(--tt-tracking-sub)] text-tt-gold-deep dark:text-tt-secondary">Trung Trương</p>
          <p className="text-sm text-muted-foreground">Theo dõi đơn ứng tuyển trên mọi thiết bị</p>
        </div>
        {message && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </p>
        )}
        <LoginButtons devLogin={process.env.NEXT_PUBLIC_DEV_LOGIN === "1"} />
      </div>
    </main>
  )
}
