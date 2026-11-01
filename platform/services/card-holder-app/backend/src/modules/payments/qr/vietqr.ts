import { OUR_BIN } from '@platform/db';

// VietQR: the EMVCo merchant-presented QR format Vietnamese banks use (NAPAS). A payload is a run of fields, each
// `tag (2 digits) + length (2 digits) + value`, ending with a CRC16 over everything before it (tag 63).

/** NAPAS's id in a VietQR account field (tag 38, sub-tag 00). */
const NAPAS_GUID = 'A000000727';
/** Our own merchant field (tag 26): not a real scheme, only this bank reads it. */
export const MERCHANT_GUID = 'VN.HCMMB.PAY';

/** Transfer to an account (QRIBFTTA) or to a card number (QRIBFTTC). */
const TO_ACCOUNT = 'QRIBFTTA';
const TO_CARD = 'QRIBFTTC';

export class QrFormatError extends Error {}

type Fields = Map<string, string>;

function parseFields(s: string): Fields {
  const fields: Fields = new Map();
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len) || i + 4 + len > s.length) {
      throw new QrFormatError('not a VietQR code');
    }
    fields.set(tag, s.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return fields;
}

const field = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, start 0xFFFF), as EMVCo specifies; covers the payload up to and including "6304".
function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(s, 'utf8')) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function withCrc(body: string): string {
  const head = `${body}6304`;
  return head + crc16(head);
}

/** What a scanned code asks for, before it is checked against this bank's accounts and merchants. */
export type ParsedQr =
  | {
      kind: 'ACCOUNT';
      bin: string;
      account: string;
      toCard: boolean;
      name: string | null;
      amount: number | null;
      note: string | null;
    }
  | { kind: 'MERCHANT'; merchantId: string; amount: number | null; reference: string | null };

export function parseQr(raw: string): ParsedQr {
  const payload = raw.trim();
  const top = parseFields(payload);
  if (top.get('00') !== '01' || !top.has('63')) throw new QrFormatError('not a VietQR code');
  if (crc16(payload.slice(0, -4)) !== payload.slice(-4).toUpperCase()) {
    throw new QrFormatError('the code is damaged (checksum mismatch)');
  }

  const amountText = top.get('54');
  const amount = amountText ? Math.round(Number(amountText)) : null;
  if (amount !== null && !(amount > 0)) throw new QrFormatError('the amount in the code is not valid');
  const extra = top.has('62') ? parseFields(top.get('62')!) : new Map<string, string>();

  const merchant = top.has('26') ? parseFields(top.get('26')!) : null;
  if (merchant?.get('00') === MERCHANT_GUID && merchant.get('01')) {
    return { kind: 'MERCHANT', merchantId: merchant.get('01')!, amount, reference: extra.get('05') ?? null };
  }

  const napas = top.has('38') ? parseFields(top.get('38')!) : null;
  if (napas?.get('00') === NAPAS_GUID && napas.has('01')) {
    const beneficiary = parseFields(napas.get('01')!);
    const bin = beneficiary.get('00');
    const account = beneficiary.get('01');
    if (bin && account) {
      return {
        kind: 'ACCOUNT',
        bin,
        account,
        toCard: napas.get('02') === TO_CARD,
        name: top.get('59')?.trim() || null,
        amount,
        note: extra.get('08') ?? null,
      };
    }
  }
  throw new QrFormatError('this QR code is not for a payment or transfer');
}

const head = (dynamic: boolean) => field('00', '01') + field('01', dynamic ? '12' : '11');
const tail = (amount: number | null, name: string, extra: string) =>
  field('53', '704') +
  (amount ? field('54', String(amount)) : '') +
  field('58', 'VN') +
  field('59', name.slice(0, 25)) +
  field('60', 'HO CHI MINH') +
  (extra ? field('62', extra) : '');

/** A code for receiving a transfer into one of our accounts, readable by any VietQR app. */
export function accountQr(account: string, name: string): string {
  const beneficiary = field('00', OUR_BIN) + field('01', account);
  const napas = field('00', NAPAS_GUID) + field('01', beneficiary) + field('02', TO_ACCOUNT);
  return withCrc(head(false) + field('38', napas) + tail(null, name, ''));
}

/** A merchant's code: static (the payer types the amount) or dynamic (amount fixed, `reference` proves it). */
export function merchantQr(merchantId: string, name: string, amount: number | null, reference: string | null): string {
  const account = field('00', MERCHANT_GUID) + field('01', merchantId);
  return withCrc(
    head(amount !== null) + field('26', account) + tail(amount, name, reference ? field('05', reference) : ''),
  );
}
