import { useSettings } from '@/data/settings';

const light = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEC',
  text: '#161616',
  muted: '#6B6B67',
  border: '#E2E2DE',
  primary: '#161616',
  primarySoft: '#EFEFEC',
  onPrimary: '#FFFFFF',
  card: '#1E2B26',
  allow: '#1F7A4D',
  allowBg: '#E6F2EB',
  stepUp: '#9A5B00',
  stepUpBg: '#FAF0DF',
  decline: '#B42318',
  declineBg: '#FBE9E7',
};

const dark: typeof light = {
  bg: '#0F0F0E',
  surface: '#1A1A19',
  surfaceAlt: '#252523',
  text: '#F2F2EF',
  muted: '#9A9A95',
  border: '#2E2E2B',
  primary: '#F2F2EF',
  primarySoft: '#252523',
  onPrimary: '#0F0F0E',
  card: '#24332D',
  allow: '#5CC08A',
  allowBg: '#16261D',
  stepUp: '#E0A341',
  stepUpBg: '#2A2112',
  decline: '#F0786B',
  declineBg: '#2E1715',
};

export type Colors = typeof light;

export function useScheme(): 'light' | 'dark' {
  return useSettings().theme;
}

export function useColors(): Colors {
  return useScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 };
