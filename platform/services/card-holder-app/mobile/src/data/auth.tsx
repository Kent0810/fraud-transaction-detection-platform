import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiEnabled, HttpError, request } from './http';
import { clearSession, readSession, writeSession } from './session-storage';
import { userFor, type User } from './users';

type Session = { cardId: string; name: string };

type AuthStore = {
  user: User | null;
  restoring: boolean;
  login: (cardId: string, password: string) => Promise<void>;
  logout: () => void;
};

// Mirrors the backend so the mock build (no EXPO_PUBLIC_API_URL) can still sign in.
const MOCK_PASSWORD = 'admin1234';
const MOCK_NAME = 'John Doe';

export const CARD_ID = /^\d{8,19}$/;

export class LoginError extends Error {}

async function signIn(cardId: string, password: string): Promise<Session> {
  if (!apiEnabled) {
    if (password !== MOCK_PASSWORD) throw new LoginError('Incorrect card number or password');
    return { cardId, name: MOCK_NAME };
  }
  try {
    return await request<Session>('POST', '/auth/login', { cardId, password });
  } catch (e) {
    if (e instanceof HttpError && (e.status === 400 || e.status === 401)) {
      throw new LoginError('Incorrect card number or password');
    }
    throw e;
  }
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    return typeof s.cardId === 'string' && CARD_ID.test(s.cardId) && typeof s.name === 'string' ? { cardId: s.cardId, name: s.name } : null;
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

  const login = useCallback(async (cardId: string, password: string) => {
    const s = await signIn(cardId, password);
    setSession(s);
    writeSession(JSON.stringify(s)).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    clearSession().catch(() => {});
  }, []);

  const value = useMemo<AuthStore>(
    () => ({ user: session ? userFor(session.cardId, session.name) : null, restoring, login, logout }),
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
