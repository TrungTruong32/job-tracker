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

export type SignInDecision = { ok: boolean; personal: boolean }

/**
 * Who may use the app: allowlisted emails (they also own a personal workspace),
 * or anyone invited to a workspace. Production accepts Google sign-ins only.
 * `hasInvite` hits the DB, so it's only called when the allowlist says no.
 */
export async function canSignIn(
  user: UserLike,
  allowed: Set<string>,
  devLogin: boolean,
  hasInvite: () => Promise<boolean>,
): Promise<SignInDecision> {
  if (!user || !(devLogin || user.app_metadata?.provider === "google")) return { ok: false, personal: false }
  if (isAllowedEmail(user.email, allowed)) return { ok: true, personal: true }
  return { ok: await hasInvite(), personal: false }
}

export function canSignInFromEnv(user: UserLike, hasInvite: () => Promise<boolean>): Promise<SignInDecision> {
  return canSignIn(user, parseAllowedEmails(process.env.ALLOWED_EMAILS), process.env.NEXT_PUBLIC_DEV_LOGIN === "1", hasInvite)
}
