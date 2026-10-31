import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { bankByBin, OUR_BIN } from '@platform/db';

import { accountQr, merchantQr, parseQr, QrFormatError } from '../qr/vietqr';
import type { MerchantQrDto, MerchantRefDto, MyQrDto, QrTargetDto } from '../types/payments.types';
import { MerchantsRepository } from './merchants.repository';

/** How long a dynamic merchant code (fixed amount) can be paid. */
const DYNAMIC_TTL_S = 10 * 60;

const unprocessable = (message: string) => new UnprocessableEntityException(message);

@Injectable()
export class QrRepository {
  // Signs dynamic merchant codes. Per process: a restart only voids codes that would expire in minutes anyway.
  private readonly secret = randomBytes(32);

  constructor(
    private readonly db: PrismaService,
    private readonly merchants: MerchantsRepository,
  ) {}

  async mine(cardId: string): Promise<MyQrDto> {
    const row = await this.db.client.accounts.findUniqueOrThrow({
      where: { card_id: cardId },
      select: { account_number: true, cardholders: { select: { first_name: true, last_name: true } } },
    });
    const name = holderName(row.cardholders);
    return { payload: accountQr(row.account_number, name), account: row.account_number, name };
  }

  async resolve(cardId: string, payload: string): Promise<QrTargetDto> {
    const qr = parse(payload);
    if (qr.kind === 'MERCHANT') {
      this.checkReference(qr.merchantId, qr.amount, qr.reference);
      return {
        kind: 'MERCHANT',
        merchant: await this.merchants.forCard(cardId, qr.merchantId),
        amount: qr.amount,
        qr: payload,
      };
    }
    if (qr.bin !== OUR_BIN) {
      const { kind: _kind, ...rest } = qr;
      return { kind: 'OTHER_BANK', bank: bankByBin(qr.bin) ?? null, ...rest };
    }
    if (qr.toCard) throw unprocessable('transfers to a card number are not supported; use the account number');
    const account = await this.db.client.accounts.findUnique({
      where: { account_number: qr.account },
      select: { card_id: true, cardholders: { select: { first_name: true, last_name: true } } },
    });
    if (!account) throw new NotFoundException('account not found');
    if (account.card_id === cardId) throw unprocessable('this is your own account');
    return {
      kind: 'TRANSFER',
      account: qr.account,
      name: holderName(account.cardholders),
      amount: qr.amount,
      note: qr.note,
    };
  }

  /** Throws unless this payment is what the scanned merchant code allows. */
  checkPayment(payload: string, merchantId: string, amount: number): void {
    const qr = parse(payload);
    if (qr.kind !== 'MERCHANT' || qr.merchantId !== merchantId)
      throw unprocessable('the QR code is for another merchant');
    this.checkReference(qr.merchantId, qr.amount, qr.reference);
    if (qr.amount !== null && qr.amount !== amount) throw unprocessable('the amount differs from the QR code');
  }

  search(query: string | undefined): MerchantRefDto[] {
    return this.merchants.search(query ?? '', 30);
  }

  merchantCode(merchantId: string, amount: number | null): MerchantQrDto {
    const merchant = this.merchants.get(merchantId);
    if (amount === null) {
      return { payload: merchantQr(merchantId, merchant.name, null, null), merchant, amount, expiresAt: null };
    }
    const expires = Math.floor(Date.now() / 1000) + DYNAMIC_TTL_S;
    const reference = `${expires}.${this.sign(merchantId, amount, expires)}`;
    return {
      payload: merchantQr(merchantId, merchant.name, amount, reference),
      merchant,
      amount,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  // A static code carries no amount and needs no proof; a code with an amount must carry a valid, unexpired signature,
  // or anyone could print a code that makes the payer pay a different amount.
  private checkReference(merchantId: string, amount: number | null, reference: string | null): void {
    if (amount === null) return;
    const [expiresText, sig] = (reference ?? '').split('.');
    const expires = Number(expiresText);
    const expected = Number.isInteger(expires) ? this.sign(merchantId, amount, expires) : '';
    if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw unprocessable('this QR code was not issued by the merchant terminal');
    }
    if (expires * 1000 < Date.now()) throw unprocessable('this QR code has expired; ask for a new one');
  }

  private sign(merchantId: string, amount: number, expires: number): string {
    return createHmac('sha256', this.secret).update(`${merchantId}|${amount}|${expires}`).digest('hex').slice(0, 12);
  }
}

function parse(payload: string) {
  try {
    return parseQr(payload);
  } catch (e) {
    if (e instanceof QrFormatError) throw unprocessable(e.message);
    throw e;
  }
}

const holderName = (c: { first_name: string; last_name: string }) => `${c.first_name} ${c.last_name}`.toUpperCase();
