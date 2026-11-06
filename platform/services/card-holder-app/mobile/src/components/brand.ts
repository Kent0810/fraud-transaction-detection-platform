import type { Bank } from '@/data/types';

export const BANK_NAME = 'HCM Mock Banking';
export const BANK_SHORT = 'HCMMB';

/** This bank, as the bank list names it. */
export const OUR_BANK: Bank = { bin: '970999', code: BANK_SHORT, name: BANK_NAME };

// Fixed so the logo looks the same in light and dark mode and matches the app icon.
export const BRAND_FROM = '#1E2B26';
export const BRAND_TO = '#1E2B26';

// 100×100 "H" monogram, shared by <Logo> and the app icon assets.
export const MONOGRAM = { path: 'M32 28 V72 M68 28 V72 M32 50 H68', stroke: 10 };
