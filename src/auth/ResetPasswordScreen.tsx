import { useState, type FormEvent } from 'react';
import { validateNewPassword } from './authLink';
import type { AuthApi } from './useAuth';

/** Shown after following a password-recovery email link. */
export function ResetPasswordScreen({ auth, email }: { auth: AuthApi; email?: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      // On success the auth state moves to signed-in and this screen unmounts.
      await auth.updatePassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password');
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <header className="page-head">
        <h1>Plate</h1>
        <p>Choose a new password{email ? ` for ${email}` : ''}.</p>
      </header>
      <form className="card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="card-body stack">
          <h2 className="serif">New password</h2>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small muted">New password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small muted">Confirm new password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" style={{ margin: 0, color: '#b3261e' }}>
              {error}
            </p>
          )}
          <button className="btn primary block" type="submit" disabled={busy || !password || !confirm}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
          <button className="btn ghost block" type="button" onClick={() => void auth.signOut()}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
