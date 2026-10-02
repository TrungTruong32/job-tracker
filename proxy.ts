import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canSignInFromEnv } from "@/lib/auth/allowed"

const PUBLIC_PATHS = ["/login", "/auth"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Refreshes the session cookie when needed; must run before any redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))

  const redirectTo = (to: string, search = "") => {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = search
    const r = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => r.cookies.set(c))
    return r
  }

  const decision = user
    ? await canSignInFromEnv(user, async () => {
        const { data } = await supabase.rpc("has_workspace_access")
        return data === true
      })
    : null
  if (user && !decision?.ok) {
    await supabase.auth.signOut()
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
    return redirectTo("/login", "?error=forbidden")
  }

  if (!user && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    return redirectTo("/login")
  }

  if (user && path === "/login") return redirectTo("/")

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|pwa-icon/|icon.svg|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
