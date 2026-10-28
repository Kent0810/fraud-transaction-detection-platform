import bcrypt from 'bcryptjs';

import type { PrismaClient } from './generated/prisma/client';

export const OUR_BANK = 'HCMMB';

export type PostTransferInput = {
  /** The signed-in card. Take it from the session, never from the request body. */
  fromCard: string;
  password: string;
  transferId: string;
  toBankCode: string;
  toAccount: string;
  toName: string;
  amount: number;
  content: string;
};

export type PostedTransfer = {
  transfer_id: string;
  reference: string;
  to_bank_code: string;
  to_account: string;
  to_name: string;
  amount: bigint;
  content: string;
  created_at: Date;
  balance: bigint;
};

export type TransferRefusalCode =
  | 'INCORRECT_PASSWORD'
  | 'ACCOUNT_NOT_FOUND'
  | 'OWN_ACCOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'TRANSFER_ID_REUSED';

export class TransferRefusedError extends Error {
  constructor(
    readonly code: TransferRefusalCode,
    message: string,
  ) {
    super(message);
    this.name = 'TransferRefusedError';
  }
}

/** The only way to move money: the transfer, both balances, the ledger entries and the outbox event in one transaction. */
export async function postTransfer(db: PrismaClient, t: PostTransferInput): Promise<PostedTransfer> {
  // Before the transaction: bcrypt is slow and shouldn't hold a lock.
  const login = await db.auth.findUnique({
    where: { card_id: t.fromCard },
    select: { password_hash: true },
  });
  if (!login || !(await bcrypt.compare(t.password, login.password_hash))) {
    throw new TransferRefusedError('INCORRECT_PASSWORD', 'incorrect password');
  }

  const to = t.toBankCode === OUR_BANK ? await internalRecipient(db, t) : null;
  const amount = BigInt(t.amount);

  return db.$transaction(async (tx) => {
    const [created] = await tx.transfers.createManyAndReturn({
      data: [
        {
          transfer_id: t.transferId,
          from_card: t.fromCard,
          to_bank_code: t.toBankCode,
          to_account: t.toAccount,
          to_name: to?.name ?? t.toName,
          to_card: to?.cardId ?? null,
          amount,
          content: t.content,
        },
      ],
      skipDuplicates: true,
    });
    if (!created) return replay(tx, t, amount);

    // card_id order, so two opposite transfers can't deadlock. The debit checks the balance in the same UPDATE.
    let balance = 0n;
    const changes = [{ card: t.fromCard, by: -amount }];
    if (to) changes.push({ card: to.cardId, by: amount });

    for (const c of changes.sort((a, b) => (a.card < b.card ? -1 : 1))) {
      if (c.by < 0n) {
        const debited = await tx.accounts.updateManyAndReturn({
          where: {
            card_id: c.card,
            balance: { gte: amount },
          },
          data: {
            balance: { decrement: amount },
            updated_at: new Date(),
          },
          select: { balance: true },
        });
        if (!debited[0]) throw new TransferRefusedError('INSUFFICIENT_FUNDS', 'insufficient funds');
        balance = debited[0].balance;
      } else {
        await tx.accounts.update({
          where: { card_id: c.card },
          data: {
            balance: { increment: amount },
            updated_at: new Date(),
          },
          select: { card_id: true },
        });
      }
    }

    await tx.ledger_entries.createMany({
      data: changes.map((c) => ({
        card_id: c.card,
        kind: c.by < 0n ? 'DEBIT' : 'CREDIT',
        amount: c.by,
        reference: created.reference,
      })),
    });

    // createMany: no RETURNING, so the app login needs no SELECT on the outbox.
    await tx.outbox.createMany({
      data: {
        aggregate_id: created.transfer_id,
        type: 'TransferPosted',
        payload: {
          transferId: created.transfer_id,
          reference: created.reference,
          kind: to ? 'INTERNAL' : 'NAPAS',
          fromCard: t.fromCard,
          toCard: to?.cardId ?? null,
          to: {
            bankCode: created.to_bank_code,
            account: created.to_account,
            name: created.to_name,
          },
          amount: Number(created.amount),
          content: created.content,
          ts: created.created_at.toISOString(),
        },
      },
    });

    return { ...created, balance };
  });
}

async function internalRecipient(db: PrismaClient, t: PostTransferInput): Promise<{ cardId: string; name: string }> {
  const account = await db.accounts.findUnique({
    where: { account_number: t.toAccount },
    select: {
      card_id: true,
      cardholders: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
  });
  if (!account) throw new TransferRefusedError('ACCOUNT_NOT_FOUND', 'account not found');
  if (account.card_id === t.fromCard) {
    throw new TransferRefusedError('OWN_ACCOUNT', 'cannot transfer to your own account');
  }
  const { first_name, last_name } = account.cardholders;
  return { cardId: account.card_id, name: `${first_name} ${last_name}`.toUpperCase() };
}

async function replay(
  tx: Pick<PrismaClient, 'transfers' | 'accounts'>,
  t: PostTransferInput,
  amount: bigint,
): Promise<PostedTransfer> {
  const first = await tx.transfers.findUniqueOrThrow({
    where: { transfer_id: t.transferId },
  });
  if (
    first.from_card !== t.fromCard ||
    first.to_bank_code !== t.toBankCode ||
    first.to_account !== t.toAccount ||
    first.amount !== amount
  ) {
    throw new TransferRefusedError('TRANSFER_ID_REUSED', 'transferId was already used for a different transfer');
  }
  const { balance } = await tx.accounts.findUniqueOrThrow({
    where: { card_id: t.fromCard },
    select: { balance: true },
  });
  return { ...first, balance };
}
