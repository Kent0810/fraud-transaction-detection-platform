import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark';

export type Settings = {
  theme: ThemeChoice;
  hideBalance: boolean;
  biometrics: boolean;
  notifyDeclines: boolean;
  notifyBudget: boolean;
  notifyTransfers: boolean;
};

type SettingsStore = Settings & {
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

// Light until the user switches; the phone's own dark mode doesn't change it.
const DEFAULTS: Settings = {
  theme: 'light',
  hideBalance: false,
  biometrics: true,
  notifyDeclines: true,
  notifyBudget: true,
  notifyTransfers: false,
};

const SettingsContext = createContext<SettingsStore | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const value = useMemo(() => ({ ...settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsStore {
  const s = useContext(SettingsContext);
  if (!s) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return s;
}
