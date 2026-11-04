import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { HttpError, request, setAuth } from './http';
import { clearSession, readSession, writeSession } from './session-storage';
import type { User } from './users';

// token is the backend session.
type Session = User & { token: string };

type AuthStore = {
  user: User | null;
  restoring: boolean;
  login: (cardId: string, password: string) => Promise<void>;
  logout: () => void;
};

export const CARD_ID = /^\d{8,19}$/;

export class LoginError extends Error {}

async function signIn(cardId: string, password: string): Promise<Session> {
  try {
    const s = await request<Session>('POST', '/auth/login', { cardId, password });
    return { cardId: s.cardId, name: s.name, email: s.email, token: s.token };
  } catch (e) {
    if (e instanceof HttpError && (e.status === 400 || e.status === 401)) {
      throw new LoginError('Incorrect card number or password');
    }
    if (e instanceof HttpError && e.status === 423) {
      throw new LoginError('Sign-in is locked after too many wrong passwords. Call the bank to unlock it.');
    }
    if (e instanceof HttpError && e.status === 403) {
      throw new LoginError('Sign-in is turned off for this card. Call the bank.');
    }
    throw e;
  }
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.cardId !== 'string' || !CARD_ID.test(s.cardId) || typeof s.name !== 'string') return null;
    // A session saved without a token or email (an older build) can't be used: sign in again.
    if (typeof s.token !== 'string' || typeof s.email !== 'string') return null;
    return { cardId: s.cardId, name: s.name, email: s.email, token: s.token };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    readSession()
      .then((raw) => setSession((current) => current ?? parseSession(raw)))
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  // Expired, revoked or locked on the server: drop the local copy too, which sends the user to login.
  const forget = useCallback(() => {
    setSession(null);
    clearSession().catch(() => {});
  }, []);

  // Set during render, not in an effect, so the children's first requests already carry the token.
  setAuth(session?.token ?? null, forget);

  const login = useCallback(async (cardId: string, password: string) => {
    const s = await signIn(cardId, password);
    setSession(s);
    writeSession(JSON.stringify(s)).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    if (session) request<void>('POST', '/auth/logout').catch(() => {});
    forget();
  }, [session, forget]);

  const value = useMemo<AuthStore>(
    () => ({ user: session, restoring, login, logout }),
    [session, restoring, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return auth;
}

export function useUser(): User {
  const { user } = useAuth();
  if (!user) {
    throw new Error('useUser needs a signed-in user');
  }
  return user;
}
