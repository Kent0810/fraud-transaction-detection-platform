import { Platform, type ViewStyle } from 'react-native';

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
  cardFrom: '#1E2B26',
  cardTo: '#1E2B26',
  allow: '#1F7A4D',
  allowBg: '#E6F2EB',
  stepUp: '#9A5B00',
  stepUpBg: '#FAF0DF',
  decline: '#B42318',
  declineBg: '#FBE9E7',
  shadow: '#161616',
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
  cardFrom: '#24332D',
  cardTo: '#24332D',
  allow: '#5CC08A',
  allowBg: '#16261D',
  stepUp: '#E0A341',
  stepUpBg: '#2A2112',
  decline: '#F0786B',
  declineBg: '#2E1715',
  shadow: '#000000',
};

export type Colors = typeof light;

export function useScheme(): 'light' | 'dark' {
  return useSettings().theme;
}

export function useColors(): Colors {
  return useScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

export function shadow(c: Colors): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 6px 20px rgba(22, 22, 22, 0.06)' } as ViewStyle,
  })!;
}
