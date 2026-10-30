import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransferRefusedError, type TransferRefusalCode } from '@platform/db';

class CardFrozenException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.LOCKED);
  }
}

// 403, not 401, for a wrong password: the session is still valid and the app shouldn't sign out.
const REFUSALS: Record<TransferRefusalCode, new (message: string) => HttpException> = {
  CARD_FROZEN: CardFrozenException,
  INCORRECT_PASSWORD: ForbiddenException,
  ACCOUNT_NOT_FOUND: NotFoundException,
  OWN_ACCOUNT: UnprocessableEntityException,
  INSUFFICIENT_FUNDS: UnprocessableEntityException,
  TRANSFER_ID_REUSED: ConflictException,
  PAYMENT_ID_REUSED: ConflictException,
};

/** Turns a refusal from @platform/db into its HTTP error; anything else is rethrown as is. */
export function asHttpError(e: unknown): unknown {
  return e instanceof TransferRefusedError ? new REFUSALS[e.code](e.message) : e;
}
