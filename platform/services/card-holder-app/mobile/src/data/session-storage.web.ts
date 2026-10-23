const KEY = 'cardholder.session';

// localStorage can throw (private mode, blocked site data); a lost session just means logging in again.
function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const readSession = async () => attempt(() => localStorage.getItem(KEY), null);

export const writeSession = async (value: string) => attempt(() => localStorage.setItem(KEY, value), undefined);

export const clearSession = async () => attempt(() => localStorage.removeItem(KEY), undefined);
