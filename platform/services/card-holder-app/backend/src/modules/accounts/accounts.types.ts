import { BadRequestException } from '@nestjs/common';

const ACCOUNT_NUMBER = /^\d{6,19}$/;

// Whole units of the currency's minor unit; for VND, đồng.
export type BalanceDto = { cardId: string; accountNumber: string; balance: number; currency: string; updatedAt: string };

// What a sender sees before transferring: the holder's name, as banks print it (upper case), and nothing else.
export type AccountHolderDto = { accountNumber: string; name: string };

export function accountNumber(value: unknown): string {
  if (typeof value !== 'string' || !ACCOUNT_NUMBER.test(value)) {
    throw new BadRequestException('accountNumber must be 6 to 19 digits');
  }
  return value;
}
