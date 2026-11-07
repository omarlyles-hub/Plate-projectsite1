import { createContext, useContext } from 'react';

/** What the UI needs to know about where data lives and the signed-in account. */
export interface SyncInfo {
  /** none: Supabase not configured. local-only: user skipped sign-in. cloud: signed in. */
  kind: 'none' | 'local-only' | 'cloud';
  email?: string;
  /** Last cloud error, or null when healthy. */
  syncError?: string | null;
  signOut?: () => Promise<void>;
  /** From local-only mode: go back to the sign-in screen. */
  signIn?: () => void;
  pendingLocalCount?: () => Promise<number>;
  uploadLocal?: () => Promise<number>;
}

export const SyncContext = createContext<SyncInfo>({ kind: 'none' });

export const useSync = () => useContext(SyncContext);
