/** Parse ALLOWED_EMAILS ("a@x.com, B@y.com") into a normalized set. */
export function parseAllowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** An empty allowlist denies everyone: forgetting the env var must not open the app. */
export function isAllowedEmail(email: string | null | undefined, allowed: Set<string>): boolean {
  return !!email && allowed.has(email.trim().toLowerCase())
}

type UserLike = { email?: string | null; app_metadata?: { provider?: string } } | null | undefined

/**
 * Allowlisted email AND signed in with Google. Email/password accounts are only
 * accepted when the local dev login is enabled.
 */
export function isAuthorizedUser(user: UserLike, allowed: Set<string>, devLogin: boolean): boolean {
  if (!user || !isAllowedEmail(user.email, allowed)) return false
  return devLogin || user.app_metadata?.provider === "google"
}

export function isAuthorizedFromEnv(user: UserLike): boolean {
  return isAuthorizedUser(user, parseAllowedEmails(process.env.ALLOWED_EMAILS), process.env.NEXT_PUBLIC_DEV_LOGIN === "1")
}
