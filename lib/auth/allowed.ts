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
