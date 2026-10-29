import { isCardFrozen, verifyPassword } from './cards';
import { Prisma, type PrismaClient } from './generated/prisma/client';

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
  | 'CARD_FROZEN'
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

/** The only way to move money: the transfer, its ledger entries and the outbox event in one transaction. */
export async function postTransfer(db: PrismaClient, t: PostTransferInput): Promise<PostedTransfer> {
  if (await isCardFrozen(db, t.fromCard)) throw frozen();
  // Before the transaction: bcrypt is slow and shouldn't hold a lock.
  if (!(await verifyPassword(db, t.fromCard, t.password))) {
    throw new TransferRefusedError('INCORRECT_PASSWORD', 'incorrect password');
  }

  const to = t.toBankCode === OUR_BANK ? await internalRecipient(db, t) : null;
  const amount = BigInt(t.amount);

  // Frozen after the check above: the database refuses the transfer (forbid_frozen_sender in V6).
  return post(db, t, to, amount).catch((e: unknown) => {
    throw isFrozenSender(e) ? frozen() : e;
  });
}

const frozen = () => new TransferRefusedError('CARD_FROZEN', 'your card is frozen');

function post(
  db: PrismaClient,
  t: PostTransferInput,
  to: { cardId: string; name: string } | null,
  amount: bigint,
): Promise<PostedTransfer> {
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

    const entries = [
      {
        card_id: t.fromCard,
        kind: 'TRANSFER',
        amount: -amount,
        reference: created.reference,
      },
    ];
    if (to) {
      entries.push({
        card_id: to.cardId,
        kind: 'TRANSFER',
        amount,
        reference: created.reference,
      });
    }

    // The database applies each entry to its balance (apply_ledger_entry). In card_id order, so two opposite
    // transfers lock the same accounts in the same order and can't deadlock.
    try {
      await tx.ledger_entries.createMany({
        data: entries.sort((a, b) => (a.card_id < b.card_id ? -1 : 1)),
      });
    } catch (e) {
      if (isOverdraft(e)) throw new TransferRefusedError('INSUFFICIENT_FUNDS', 'insufficient funds');
      throw e;
    }

    const { balance } = await tx.accounts.findUniqueOrThrow({
      where: { card_id: t.fromCard },
      select: { balance: true },
    });

    // createMany: no RETURNING, so the app login needs no SELECT on the outbox.
    await tx.outbox.createMany({
      data: {
        aggregate_type: 'transfers',
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

// apply_ledger_entry() took the balance below zero: CHECK (balance >= 0) on accounts, SQLSTATE 23514.
function isOverdraft(e: unknown): boolean {
  const cause = postgresError(e);
  return cause?.originalCode === '23514' && !!cause.originalMessage?.includes('accounts_balance_check');
}

// forbid_frozen_sender() refused the transfer: SQLSTATE 55000 (object_not_in_prerequisite_state).
function isFrozenSender(e: unknown): boolean {
  return postgresError(e)?.originalCode === '55000';
}

// Prisma wraps a Postgres error; its own SQLSTATE and message are on the driver adapter's cause.
function postgresError(e: unknown): { originalCode?: string; originalMessage?: string } | undefined {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return (e.meta?.driverAdapterError as { cause?: { originalCode?: string; originalMessage?: string } })?.cause;
}
