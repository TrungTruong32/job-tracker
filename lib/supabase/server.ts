import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isAuthorizedFromEnv } from "@/lib/auth/allowed"
import type { Database } from "./types"

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component: the proxy refreshes the session instead.
          }
        },
      },
    },
  )
}

/**
 * Signed-in, allowlisted user, or throws. The proxy also checks this, but every
 * action/route/page re-checks here so nothing depends on the proxy matcher alone.
 */
export async function requireUser() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error("Chưa đăng nhập")
  if (!isAuthorizedFromEnv(data.user)) throw new Error("Không có quyền truy cập")
  return { supabase, user: data.user }
}
