import { useCallback, useEffect, useState } from 'react';

/**
 * Shares plain text via the system share sheet when available, otherwise copies it to the
 * clipboard. Returns the function plus a transient message the caller can render.
 */
export function useShare(): (text: string) => void {
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(undefined), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const share = useCallback((text: string) => {
    void (async () => {
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share({ text });
          return;
        }
        await navigator.clipboard.writeText(text);
        setMessage('Copied to clipboard');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the sheet
        setMessage('Could not share. Select and copy instead.');
      }
    })();
  }, []);

  // The message is surfaced through a global toast element so callers need no markup.
  useEffect(() => {
    if (!message) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    return () => el.remove();
  }, [message]);

  return share;
}
