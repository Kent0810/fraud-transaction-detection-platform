import { isCardFrozen, verifyPassword } from './cards';
import { Prisma, type PrismaClient, type transfers } from './generated/prisma/client';

export const OUR_BANK = 'HCMMB';

const REQUESTS_TOPIC = 'transfer-requests';
const OUTCOMES_TOPIC = 'transfers';

export type TransferStatus = 'PENDING' | 'POSTED' | 'DECLINED';

export type TransferRequestInput = {
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

export type TransferDecision = {
  transferId: string;
  approve: boolean;
  firedRules: string[];
};

export type TransferState = transfers & { balance: bigint };

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

/** Records the transfer as PENDING for the fraud detector; no money moves until settleTransfer(). */
export async function requestTransfer(db: PrismaClient, t: TransferRequestInput): Promise<TransferState> {
  if (await isCardFrozen(db, t.fromCard)) {
    throw frozen();
  }

  if (!(await verifyPassword(db, t.fromCard, t.password))) {
    throw new TransferRefusedError('INCORRECT_PASSWORD', 'incorrect password');
  }

  const to = t.toBankCode === OUR_BANK ? await internalRecipient(db, t) : null;
  const amount = BigInt(t.amount);

  // Not a hold: the balance is checked again when the money moves.
  if ((await balanceOf(db, t.fromCard)) < amount) {
    throw insufficientFunds();
  }

  // Frozen after the check above: the database refuses the transfer (forbid_frozen_sender in V6).
  return record(db, t, to, amount).catch((e: unknown) => {
    throw isFrozenSender(e) ? frozen() : e;
  });
}

/** Posts an approved transfer or closes a declined one. Safe to repeat: a decided transfer is returned as is. */
export async function settleTransfer(db: PrismaClient, d: TransferDecision): Promise<TransferState | null> {
  if (!d.approve) {
    return decline(db, d.transferId, d.firedRules);
  }
  try {
    return await post(db, d.transferId);
  } catch (e) {
    if (isOverdraft(e)) return decline(db, d.transferId, ['INSUFFICIENT_FUNDS']);
    if (isFrozenSender(e)) return decline(db, d.transferId, ['FROZEN']);
    throw e;
  }
}

export async function getTransfer(
  db: PrismaClient,
  fromCard: string,
  transferId: string,
): Promise<TransferState | null> {
  const t = await db.transfers.findFirst({
    where: {
      transfer_id: transferId,
      from_card: fromCard,
    },
  });
  return t && { ...t, balance: await balanceOf(db, fromCard) };
}

const frozen = () => new TransferRefusedError('CARD_FROZEN', 'your card is frozen');
const insufficientFunds = () => new TransferRefusedError('INSUFFICIENT_FUNDS', 'insufficient funds');

function record(
  db: PrismaClient,
  t: TransferRequestInput,
  to: { cardId: string; name: string } | null,
  amount: bigint,
): Promise<TransferState> {
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

    await tx.outbox.createMany({ data: event(REQUESTS_TOPIC, 'TransferRequested', created) });
    return { ...created, balance: await balanceOf(tx, t.fromCard) };
  });
}

function post(db: PrismaClient, transferId: string): Promise<TransferState | null> {
  return db.$transaction(async (tx) => {
    const [t] = await tx.transfers.updateManyAndReturn({
      where: {
        transfer_id: transferId,
        status: 'PENDING',
      },
      data: {
        status: 'POSTED',
        decided_at: new Date(),
      },
    });
    if (!t) return current(tx, transferId);

    const entries = [
      {
        card_id: t.from_card,
        kind: 'TRANSFER',
        amount: -t.amount,
        reference: t.reference,
      },
    ];
    if (t.to_card) {
      entries.push({
        card_id: t.to_card,
        kind: 'TRANSFER',
        amount: t.amount,
        reference: t.reference,
      });
    }

    // The database applies each entry to its balance (apply_ledger_entry). In card_id order, so two opposite
    // transfers lock the same accounts in the same order and can't deadlock.
    await tx.ledger_entries.createMany({
      data: entries.sort((a, b) => (a.card_id < b.card_id ? -1 : 1)),
    });

    await tx.outbox.createMany({ data: event(OUTCOMES_TOPIC, 'TransferPosted', t) });
    return { ...t, balance: await balanceOf(tx, t.from_card) };
  });
}

function decline(db: PrismaClient, transferId: string, reasons: string[]): Promise<TransferState | null> {
  return db.$transaction(async (tx) => {
    const [t] = await tx.transfers.updateManyAndReturn({
      where: {
        transfer_id: transferId,
        status: 'PENDING',
      },
      data: {
        status: 'DECLINED',
        declined_for: reasons.length ? reasons : ['DECLINED'],
        decided_at: new Date(),
      },
    });
    if (!t) return current(tx, transferId);

    await tx.outbox.createMany({ data: event(OUTCOMES_TOPIC, 'TransferDeclined', t) });
    return { ...t, balance: await balanceOf(tx, t.from_card) };
  });
}

type Tx = Pick<PrismaClient, 'transfers' | 'accounts'>;

async function current(tx: Tx, transferId: string): Promise<TransferState | null> {
  const t = await tx.transfers.findUnique({
    where: { transfer_id: transferId },
  });
  return t && { ...t, balance: await balanceOf(tx, t.from_card) };
}

// Same shape as a card payment on the transactions topic. createMany: no RETURNING, so no SELECT on the outbox.
function event(topic: string, type: string, t: transfers): Prisma.outboxCreateManyInput {
  return {
    aggregate_type: topic,
    aggregate_id: t.from_card,
    type,
    payload: {
      txn_id: t.transfer_id,
      ts: t.created_at.toISOString(),
      ts_epoch: t.created_at.getTime() / 1000,
      cc_num: t.from_card,
      channel: 'TRANSFER',
      merchant: t.to_name,
      counterparty_account: `${t.to_bank_code}:${t.to_account}`,
      category: 'transfer',
      amt: Number(t.amount),
      currency: 'VND',
      merch_lat: null,
      merch_long: null,
      reference: t.reference,
      kind: t.to_card ? 'INTERNAL' : 'NAPAS',
      to_card: t.to_card,
      content: t.content,
      status: t.status,
      decision: VERDICT[t.status as TransferStatus],
      fired_rules: t.declined_for,
      decided_at: t.decided_at?.toISOString() ?? null,
    },
  };
}

const VERDICT: Record<TransferStatus, 'ALLOW' | 'DECLINE' | null> = {
  PENDING: null,
  POSTED: 'ALLOW',
  DECLINED: 'DECLINE',
};

async function balanceOf(tx: Pick<PrismaClient, 'accounts'>, cardId: string): Promise<bigint> {
  const { balance } = await tx.accounts.findUniqueOrThrow({
    where: { card_id: cardId },
    select: { balance: true },
  });
  return balance;
}

async function internalRecipient(
  db: PrismaClient,
  t: TransferRequestInput,
): Promise<{ cardId: string; name: string }> {
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

async function replay(tx: Tx, t: TransferRequestInput, amount: bigint): Promise<TransferState> {
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
  return { ...first, balance: await balanceOf(tx, t.fromCard) };
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
