import { BadRequestException } from '@nestjs/common';

import { record, text } from '../common/validation';

const BANK_CODE = /^[A-Z]{2,10}$/;
const ACCOUNT = /^\d{6,19}$/;

export type RecipientDto = { bankCode: string; account: string; name: string; createdAt: string };

export function bankCode(value: unknown): string {
  if (typeof value !== 'string' || !BANK_CODE.test(value)) throw new BadRequestException('bankCode must be 2 to 10 capital letters');
  return value;
}

export function account(value: unknown): string {
  if (typeof value !== 'string' || !ACCOUNT.test(value)) throw new BadRequestException('account must be 6 to 19 digits');
  return value;
}

export function parseRecipientName(body: unknown): string {
  return text(record(body, 'body').name, 'name', 100);
}
