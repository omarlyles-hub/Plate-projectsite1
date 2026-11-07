import { useState, type FormEvent } from 'react';
import type { AuthApi } from './useAuth';

const MIN_PASSWORD = 6; // Supabase's default minimum

export function AuthScreen({ auth }: { auth: AuthApi }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setNotice(undefined);
    if (mode === 'sign-up' && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await auth.signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await auth.signUp(email.trim(), password);
        if (needsConfirmation) {
          setNotice(
            'Account created. Check your email and click the confirmation link, then sign in.',
          );
          setMode('sign-in');
        }
        // Otherwise the auth listener signs the user in and this screen unmounts.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const signUp = mode === 'sign-up';

  return (
    <main className="app">
      <header className="page-head">
        <h1>Plate</h1>
        <p>Your dining journal, built from your photos.</p>
      </header>
      <form className="card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="card-body stack">
          <h2 className="serif">{signUp ? 'Create your account' : 'Sign in'}</h2>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small muted">Email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small muted">Password</span>
            <input
              className="input"
              type="password"
              autoComplete={signUp ? 'new-password' : 'current-password'}
              required
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" style={{ margin: 0, color: '#b3261e' }}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" style={{ margin: 0 }}>
              {notice}
            </p>
          )}
          <button className="btn primary block" type="submit" disabled={busy || !email || !password}>
            {busy ? 'One moment…' : signUp ? 'Create account' : 'Sign in'}
          </button>
          <button
            className="btn ghost block"
            type="button"
            onClick={() => {
              setMode(signUp ? 'sign-in' : 'sign-up');
              setError(undefined);
              setNotice(undefined);
            }}
          >
            {signUp ? 'I already have an account' : 'New here? Create an account'}
          </button>
        </div>
      </form>
      <p className="small muted" style={{ textAlign: 'center', margin: '20px 8px 0' }}>
        Signing in saves your meals, venues and dishes to your private account so they follow you
        across devices. Photos and thumbnails always stay on this device.
      </p>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="btn ghost" type="button" onClick={auth.useWithoutAccount}>
          Use on this device only
        </button>
      </div>
    </main>
  );
}
