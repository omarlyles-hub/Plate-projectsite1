import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../data/supabaseClient';

export type AuthStatus =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; session: Session }
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
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  useWithoutAccount(): void;
  /** Leave local-only mode and show the sign-in screen again. */
  showSignIn(): void;
}

/** Email + password auth over Supabase. Requires `supabase` to be configured. */
export function useAuth(): AuthApi {
  const [status, setStatus] = useState<AuthStatus>({ kind: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setStatus({ kind: 'signed-in', session: data.session });
      else setStatus(readLocalOnly() ? { kind: 'local-only' } : { kind: 'signed-out' });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const useWithoutAccount = useCallback(() => {
    writeLocalOnly(true);
    setStatus({ kind: 'local-only' });
  }, []);

  const showSignIn = useCallback(() => {
    writeLocalOnly(false);
    setStatus({ kind: 'signed-out' });
  }, []);

  return { status, signIn, signUp, signOut, useWithoutAccount, showSignIn };
}
