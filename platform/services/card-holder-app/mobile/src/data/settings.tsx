import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

// User preferences. In memory only: they reset when the app restarts.
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

const DEFAULTS: Omit<Settings, 'theme'> = {
  hideBalance: false,
  biometrics: true,
  notifyDeclines: true,
  notifyBudget: true,
  notifyTransfers: false,
};

export const PROFILE = { name: 'Jamie Carter', email: 'jamie@example.com', memberSince: '2021' };

const SettingsContext = createContext<SettingsStore | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start in the device's mode; after that, the user's choice wins.
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    theme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  }));

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
