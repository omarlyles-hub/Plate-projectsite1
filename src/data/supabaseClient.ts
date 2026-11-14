import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseAuthLink, type AuthLinkInfo } from '../auth/authLink';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * What the URL said when the page loaded (recovery link? expired link?). Captured before the
 * client exists because supabase-js removes the tokens from the URL as it initialises.
 */
export const initialAuthLink: AuthLinkInfo =
  typeof window === 'undefined'
    ? { recovery: false, error: null }
    : parseAuthLink(window.location.hash, window.location.search);

/** True when both env vars are set. Without them the app runs fully on-device. */
export const supabaseConfigured = Boolean(url && key);

/** Only the publishable key is ever used in the browser. Row-level security does the protecting. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
