import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialAuthLink, supabase } from '../data/supabaseClient';

export type AuthStatus =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; session: Session }
  /** Opened from a recovery email: the user must choose a new password before anything else. */
  | { kind: 'recovery'; session: Session }
  | { kind: 'local-only' };

const LOCAL_ONLY_KEY = 'plate.localOnly';

function readLocalOnly(): boolean {
  try {
    return localStorage.getItem(LOCAL_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}
function writeLocalOnly(on: boolean) {
  try {
    if (on) localStorage.setItem(LOCAL_ONLY_KEY, '1');
    else localStorage.removeItem(LOCAL_ONLY_KEY);
  } catch {
    /* private mode: the choice just won't persist */
  }
}

export interface SignUpResult {
  /** True when the project requires email confirmation, so no session exists yet. */
  needsConfirmation: boolean;
}

export interface AuthApi {
  status: AuthStatus;
  /** A problem with an emailed link (e.g. expired), shown on the sign-in screen. */
  linkError: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Emails a password-reset link. Resolves the same way whether or not the account exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password during recovery, then continues into the app signed in. */
  updatePassword(newPassword: string): Promise<void>;
  useWithoutAccount(): void;
  /** Leave local-only mode and show the sign-in screen again. */
  showSignIn(): void;
}

/** Where the emailed link should send the user back to. Must be allowed in Supabase's redirect URLs. */
export const resetRedirectUrl = () => `${window.location.origin}${window.location.pathname}`;

/** Email + password auth over Supabase. Requires `supabase` to be configured. */
export function useAuth(): AuthApi {
  const [status, setStatus] = useState<AuthStatus>({ kind: 'loading' });
  const [linkError, setLinkError] = useState<string | null>(initialAuthLink.error);
  // Set once we know this page load is a recovery. Later auth events (token refresh etc.)
  // must not bounce the user past the new-password screen.
  const recovering = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session && initialAuthLink.recovery) {
        recovering.current = true;
        setStatus({ kind: 'recovery', session: data.session });
      } else if (data.session) {
        setStatus({ kind: 'signed-in', session: data.session });
      } else {
        // Someone who followed a broken reset link needs the sign-in screen (where the error
        // and "Forgot password?" live), even if they previously chose device-only mode.
        const skipSignIn = readLocalOnly() && !initialAuthLink.error;
        setStatus(skipSignIn ? { kind: 'local-only' } : { kind: 'signed-out' });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recovering.current = true;
        setStatus({ kind: 'recovery', session });
        return;
      }
      if (recovering.current) {
        // Stay on the new-password screen until the password is saved or the user cancels.
        if (!session) {
          recovering.current = false;
          setStatus(readLocalOnly() ? { kind: 'local-only' } : { kind: 'signed-out' });
        }
        return;
      }
      if (session) {
        writeLocalOnly(false);
        setStatus({ kind: 'signed-in', session });
      } else {
        setStatus(readLocalOnly() ? { kind: 'local-only' } : { kind: 'signed-out' });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    setLinkError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) throw new Error('Supabase is not configured');
    setLinkError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    recovering.current = false;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl(),
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    // The recovery session is a normal session; carry on into the app signed in.
    recovering.current = false;
    writeLocalOnly(false);
    const { data: current } = await supabase.auth.getSession();
    if (current.session) setStatus({ kind: 'signed-in', session: current.session });
    else if (data.user) setStatus({ kind: 'signed-out' });
  }, []);

  const useWithoutAccount = useCallback(() => {
    writeLocalOnly(true);
    setStatus({ kind: 'local-only' });
  }, []);

  const showSignIn = useCallback(() => {
    writeLocalOnly(false);
    setStatus({ kind: 'signed-out' });
  }, []);

  return {
    status,
    linkError,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    useWithoutAccount,
    showSignIn,
  };
}
