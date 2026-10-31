/** Banks a transfer can go to, by their NAPAS bank id (BIN): ours, and the others reachable through NAPAS. */
export type Bank = { bin: string; code: string; name: string };

/** Made up for the mock bank; real bank ids start 9704. */
export const OUR_BIN = '970999';

export const BANKS: Bank[] = [
  { bin: OUR_BIN, code: 'HCMMB', name: 'HCM Mock Banking' },
  { bin: '970416', code: 'ACB', name: 'Asia Commercial Bank' },
  { bin: '970405', code: 'Agribank', name: 'Vietnam Bank for Agriculture and Rural Development' },
  { bin: '970418', code: 'BIDV', name: 'Bank for Investment and Development of Vietnam' },
  { bin: '970437', code: 'HDBank', name: 'Ho Chi Minh City Development Bank' },
  { bin: '970422', code: 'MB', name: 'Military Commercial Bank' },
  { bin: '970426', code: 'MSB', name: 'Vietnam Maritime Commercial Bank' },
  { bin: '970448', code: 'OCB', name: 'Orient Commercial Bank' },
  { bin: '970403', code: 'Sacombank', name: 'Saigon Thuong Tin Commercial Bank' },
  { bin: '970443', code: 'SHB', name: 'Saigon - Hanoi Commercial Bank' },
  { bin: '970407', code: 'Techcombank', name: 'Vietnam Technological and Commercial Bank' },
  { bin: '970423', code: 'TPBank', name: 'Tien Phong Commercial Bank' },
  { bin: '970441', code: 'VIB', name: 'Vietnam International Bank' },
  { bin: '970436', code: 'Vietcombank', name: 'Bank for Foreign Trade of Vietnam' },
  { bin: '970415', code: 'VietinBank', name: 'Vietnam Bank for Industry and Trade' },
  { bin: '970432', code: 'VPBank', name: 'Vietnam Prosperity Bank' },
];

export const bankByBin = (bin: string): Bank | undefined => BANKS.find((b) => b.bin === bin);
