import { describe, expect, it } from 'vitest';
import { parseAuthLink, validateNewPassword } from './authLink';

describe('parseAuthLink', () => {
  it('detects a recovery link in the hash', () => {
    const info = parseAuthLink('#access_token=abc&expires_in=3600&refresh_token=def&type=recovery', '');
    expect(info).toEqual({ recovery: true, error: null });
  });

  it('ignores an ordinary app route', () => {
    expect(parseAuthLink('#/journal', '')).toEqual({ recovery: false, error: null });
    expect(parseAuthLink('', '')).toEqual({ recovery: false, error: null });
  });

  it('does not treat a signup/magic-link token as recovery', () => {
    expect(parseAuthLink('#access_token=abc&type=signup', '').recovery).toBe(false);
  });

  it('requires a token, so a stray type=recovery does nothing', () => {
    expect(parseAuthLink('#type=recovery', '').recovery).toBe(false);
  });

  it('reports an expired link with a friendly message', () => {
    const info = parseAuthLink(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      '',
    );
    expect(info.recovery).toBe(false);
    expect(info.error).toMatch(/expired or was already used/);
  });

  it('falls back to the provider description for other errors', () => {
    const info = parseAuthLink('#error=server_error&error_description=Something+broke', '');
    expect(info.error).toBe('Something broke');
  });

  it('also reads the query string', () => {
    expect(parseAuthLink('', '?error=x&error_code=otp_expired').error).toMatch(/expired/);
  });
});

describe('validateNewPassword', () => {
  it('rejects short passwords', () => {
    expect(validateNewPassword('12345', '12345')).toMatch(/at least 6/);
  });
  it('rejects mismatches', () => {
    expect(validateNewPassword('hunter22', 'hunter23')).toMatch(/don't match/);
  });
  it('accepts a matching password of enough length', () => {
    expect(validateNewPassword('hunter22', 'hunter22')).toBeNull();
  });
});
