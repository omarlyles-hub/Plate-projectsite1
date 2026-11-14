export interface AuthLinkInfo {
  /** The page was opened from a password-recovery email link. */
  recovery: boolean;
  /** A friendly message when Supabase reported a problem with the link, otherwise null. */
  error: string | null;
}

/**
 * Reads what Supabase put in the URL when the user followed an emailed link.
 *
 * With the implicit flow the recovery link lands on `#access_token=...&type=recovery`; a bad
 * or expired link lands on `#error=access_denied&error_code=otp_expired&...`. supabase-js
 * strips these from the URL as soon as it initialises, so this must run before the client is
 * created.
 */
export function parseAuthLink(hash: string, search: string): AuthLinkInfo {
  const params = new URLSearchParams(`${hash.replace(/^#\/?/, '')}&${search.replace(/^\?/, '')}`);
  const recovery = params.get('type') === 'recovery' && params.has('access_token');

  let error: string | null = null;
  if (params.has('error') || params.has('error_code')) {
    const code = params.get('error_code');
    error =
      code === 'otp_expired' || code === 'access_denied'
        ? 'That reset link has expired or was already used. Request a new one below.'
        : (params.get('error_description') ?? 'That link could not be used. Request a new one below.');
  }
  return { recovery, error };
}

export const MIN_PASSWORD = 6; // Supabase's default minimum

/** Returns a message when the new password is not acceptable, otherwise null. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}
