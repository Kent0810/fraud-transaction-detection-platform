import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as api from './api';
import { setAuth } from './http';
import type { StaffSession } from './types';

const KEY = 'ops-console.session';

type Auth = {
  session: StaffSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

function load(): StaffSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as StaffSession) : null;
    return s && new Date(s.expiresAt) > new Date() ? s : null;
  } catch {
    return null;
  }
}

// After a reload, the pages' first requests go out in their effects, which run before this provider's: hand the saved
// token to the client right away, so they carry it.
function restore(): StaffSession | null {
  const s = load();
  setAuth(s?.token ?? null);
  return s;
}

function save(s: StaffSession | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Without storage the session lasts until the tab reloads.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(restore);

  const forget = useCallback(() => {
    save(null);
    setSession(null);
  }, []);

  useEffect(() => {
    setAuth(session?.token ?? null, forget);
  }, [session, forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await api.login(email, password);
      setAuth(s.token, forget);
      save(s);
      setSession(s);
    },
    [forget],
  );

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    forget();
  }, [forget]);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}
