import { Platform, type ViewStyle } from 'react-native';

import { useSettings } from '@/data/settings';

const light = {
  bg: '#F3F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F6',
  text: '#0E1525',
  muted: '#6B7385',
  border: '#E4E7EE',
  primary: '#4F46E5',
  primarySoft: '#EAE8FD',
  onPrimary: '#FFFFFF',
  cardFrom: '#312E81',
  cardTo: '#6D28D9',
  allow: '#16A34A',
  allowBg: '#E7F7EC',
  stepUp: '#D97706',
  stepUpBg: '#FEF3E2',
  decline: '#DC2626',
  declineBg: '#FDE8E8',
  shadow: '#0E1525',
};

const dark: typeof light = {
  bg: '#0A0D14',
  surface: '#151A24',
  surfaceAlt: '#1D2330',
  text: '#F2F4F8',
  muted: '#8C94A6',
  border: '#232A38',
  primary: '#8B85FF',
  primarySoft: '#25224A',
  onPrimary: '#0A0D14',
  cardFrom: '#3730A3',
  cardTo: '#7C3AED',
  allow: '#4ADE80',
  allowBg: '#12291B',
  stepUp: '#FBBF24',
  stepUpBg: '#2E2410',
  decline: '#F87171',
  declineBg: '#331616',
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
    default: { boxShadow: '0 6px 20px rgba(14, 21, 37, 0.06)' } as ViewStyle,
  })!;
}
