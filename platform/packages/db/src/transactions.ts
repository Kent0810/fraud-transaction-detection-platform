import { isCardFrozen, verifyPassword } from './cards';
import { Prisma, type PrismaClient, type transactions } from './generated/prisma/client';

export const OUR_BANK = 'HCMMB';

const REQUESTS_TOPIC = 'transactions';
const OUTCOMES_TOPIC = 'settlements';

export type TransactionStatus = 'PENDING' | 'POSTED' | 'DECLINED';

export type TransferRequestInput = {
  /** The signed-in card. Take it from the session, never from the request body. */
  fromCard: string;
  password: string;
  transferId: string;
  /** An account number of this bank; the recipient's name comes from its cardholder. */
  toAccount: string;
  amount: number;
  content: string;
};

export type PaymentRequestInput = {
  /** The signed-in card. Take it from the session, never from the request body. */
  fromCard: string;
  password: string;
  paymentId: string;
  merchant: string;
  category: string;
  amount: number;
  merchLat: number | null;
  merchLong: number | null;
};

/** The fraud detector's verdict on one transaction, from the decisions topic. */
export type DecisionInput = {
  txnId: string;
  cardId: string;
  channel: 'CARD' | 'TRANSFER';
  ts: string;
  merchant: string | null;
  category: string | null;
  amount: number;
  merchLat: number | null;
  merchLong: number | null;
  verdict: 'ALLOW' | 'STEP_UP' | 'DECLINE';
  firedRules: string[];
};

export type TransactionState = transactions & { balance: bigint };

export type TransferRefusalCode =
  | 'CARD_FROZEN'
  | 'INCORRECT_PASSWORD'
  | 'ACCOUNT_NOT_FOUND'
  | 'OWN_ACCOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'TRANSFER_ID_REUSED'
  | 'PAYMENT_ID_REUSED';

export class TransferRefusedError extends Error {
  constructor(
    readonly code: TransferRefusalCode,
    message: string,
  ) {
    super(message);
    this.name = 'TransferRefusedError';
  }
}

/** Records the transfer as PENDING for the fraud detector; no money moves until settle(). */
export async function requestTransfer(db: PrismaClient, t: TransferRequestInput): Promise<TransactionState> {
  await checkSender(db, t.fromCard, t.password);
  const to = await recipient(db, t);
  const amount = BigInt(t.amount);
  await checkBalance(db, t.fromCard, amount);
  return refuseIfFrozen(record(db, t, to, amount));
}

/** Records a card payment made in the app as PENDING, like a transfer; no money moves until settle(). */
export async function requestPayment(db: PrismaClient, p: PaymentRequestInput): Promise<TransactionState> {
  await checkSender(db, p.fromCard, p.password);
  const amount = BigInt(p.amount);
  await checkBalance(db, p.fromCard, amount);
  return refuseIfFrozen(recordPayment(db, p, amount));
}

/**
 * Applies a decision: posts or declines a pending transfer, or records a card payment already decided. Safe to
 * repeat: a decided transaction is returned as is. Null when the transfer or the card is unknown.
 */
export async function settle(db: PrismaClient, d: DecisionInput): Promise<TransactionState | null> {
  const approve = d.verdict === 'ALLOW';
  const reasons = d.firedRules.length ? d.firedRules : [d.verdict];
  const run = d.channel === 'CARD' ? cardPayment(db, d) : transfer(db, d);

  if (!approve) {
    return run('DECLINED', reasons);
  }
  try {
    return await run('POSTED', []);
  } catch (e) {
    if (isOverdraft(e)) return run('DECLINED', ['INSUFFICIENT_FUNDS']);
    if (isFrozenSender(e)) return run('DECLINED', ['FROZEN']);
    throw e;
  }
}

export function getTransfer(db: PrismaClient, fromCard: string, transferId: string): Promise<TransactionState | null> {
  return getOwn(db, fromCard, transferId, 'TRANSFER');
}

export function getPayment(db: PrismaClient, fromCard: string, paymentId: string): Promise<TransactionState | null> {
  return getOwn(db, fromCard, paymentId, 'CARD');
}

async function getOwn(
  db: PrismaClient,
  fromCard: string,
  txnId: string,
  channel: 'CARD' | 'TRANSFER',
): Promise<TransactionState | null> {
  const t = await db.transactions.findFirst({
    where: {
      txn_id: txnId,
      card_id: fromCard,
      channel,
    },
  });
  return t && { ...t, balance: await balanceOf(db, fromCard) };
}

const frozen = () => new TransferRefusedError('CARD_FROZEN', 'your card is frozen');
const insufficientFunds = () => new TransferRefusedError('INSUFFICIENT_FUNDS', 'insufficient funds');

async function checkSender(db: PrismaClient, card: string, password: string): Promise<void> {
  if (await isCardFrozen(db, card)) {
    throw frozen();
  }
  if (!(await verifyPassword(db, card, password))) {
    throw new TransferRefusedError('INCORRECT_PASSWORD', 'incorrect password');
  }
}

// Not a hold: the balance is checked again when the money moves.
async function checkBalance(db: PrismaClient, card: string, amount: bigint): Promise<void> {
  if ((await balanceOf(db, card)) < amount) {
    throw insufficientFunds();
  }
}

// Frozen after checkSender(): the database refuses the transaction (forbid_frozen_sender).
function refuseIfFrozen(recording: Promise<TransactionState>): Promise<TransactionState> {
  return recording.catch((e: unknown) => {
    throw isFrozenSender(e) ? frozen() : e;
  });
}

type Outcome = 'POSTED' | 'DECLINED';
type Settle = (status: Outcome, reasons: string[]) => Promise<TransactionState | null>;

function record(
  db: PrismaClient,
  t: TransferRequestInput,
  to: { cardId: string; name: string },
  amount: bigint,
): Promise<TransactionState> {
  return db.$transaction(async (tx) => {
    const [created] = await tx.transactions.createManyAndReturn({
      data: [
        {
          txn_id: t.transferId,
          card_id: t.fromCard,
          channel: 'TRANSFER',
          to_account: t.toAccount,
          to_name: to.name,
          to_card: to.cardId,
          amount,
          content: t.content,
        },
      ],
      skipDuplicates: true,
    });
    if (!created) return replay(tx, t, amount);

    await tx.outbox.createMany({ data: requested(created) });
    return { ...created, balance: await balanceOf(tx, t.fromCard) };
  });
}

function recordPayment(db: PrismaClient, p: PaymentRequestInput, amount: bigint): Promise<TransactionState> {
  return db.$transaction(async (tx) => {
    const [created] = await tx.transactions.createManyAndReturn({
      data: [
        {
          txn_id: p.paymentId,
          card_id: p.fromCard,
          channel: 'CARD',
          merchant: p.merchant,
          category: p.category,
          merch_lat: p.merchLat,
          merch_long: p.merchLong,
          amount,
        },
      ],
      skipDuplicates: true,
    });
    if (!created) return replayPayment(tx, p, amount);

    await tx.outbox.createMany({ data: requested(created) });
    return { ...created, balance: await balanceOf(tx, p.fromCard) };
  });
}

// A transfer was recorded PENDING by requestTransfer(); the decision moves it on, once.
function transfer(db: PrismaClient, d: DecisionInput): Settle {
  return (status, reasons) =>
    db.$transaction(async (tx) => {
      const [t] = await tx.transactions.updateManyAndReturn({
        where: {
          txn_id: d.txnId,
          card_id: d.cardId,
          channel: 'TRANSFER',
          status: 'PENDING',
        },
        data: {
          status,
          declined_for: reasons,
          decided_at: new Date(),
        },
      });
      if (!t) return current(tx, d);

      if (status === 'POSTED') await postEntries(tx, t);
      await tx.outbox.createMany({ data: settled(t) });
      return { ...t, balance: await balanceOf(tx, t.card_id) };
    });
}

// A card payment made in the app was recorded PENDING by requestPayment() and is decided like a transfer. One from the
// event source is recorded only now, already decided, together with its entry and outcome.
function cardPayment(db: PrismaClient, d: DecisionInput): Settle {
  return async (status, reasons) => {
    try {
      return await db.$transaction(async (tx) => {
        const [pending] = await tx.transactions.updateManyAndReturn({
          where: {
            txn_id: d.txnId,
            card_id: d.cardId,
            channel: 'CARD',
            status: 'PENDING',
          },
          data: {
            status,
            declined_for: reasons,
            decided_at: new Date(),
          },
        });
        const [t] = pending
          ? [pending]
          : await tx.transactions.createManyAndReturn({
              data: [
                {
                  txn_id: d.txnId,
                  card_id: d.cardId,
                  channel: 'CARD',
                  merchant: d.merchant,
                  category: d.category,
                  merch_lat: d.merchLat,
                  merch_long: d.merchLong,
                  amount: BigInt(d.amount),
                  status,
                  declined_for: reasons,
                  created_at: new Date(d.ts),
                  decided_at: new Date(),
                },
              ],
              skipDuplicates: true,
            });
        if (!t) return current(tx, d);

        if (status === 'POSTED') await postEntries(tx, t);
        await tx.outbox.createMany({ data: settled(t) });
        return { ...t, balance: await balanceOf(tx, t.card_id) };
      });
    } catch (e) {
      if (isUnknownCard(e)) return null;
      throw e;
    }
  };
}

type Tx = Pick<PrismaClient, 'transactions' | 'accounts' | 'ledger_entries'>;

// The database applies each entry to its balance (apply_ledger_entry). In card_id order, so two opposite
// transfers lock the same accounts in the same order and can't deadlock.
async function postEntries(tx: Tx, t: transactions): Promise<void> {
  const kind = t.channel === 'CARD' ? 'CARD_PAYMENT' : 'TRANSFER';
  const entries = [
    {
      card_id: t.card_id,
      kind,
      amount: -t.amount,
      reference: t.reference,
    },
  ];
  if (t.to_card) {
    entries.push({
      card_id: t.to_card,
      kind,
      amount: t.amount,
      reference: t.reference,
    });
  }
  await tx.ledger_entries.createMany({
    data: entries.sort((a, b) => (a.card_id < b.card_id ? -1 : 1)),
  });
}

async function current(tx: Tx, d: DecisionInput): Promise<TransactionState | null> {
  const t = await tx.transactions.findFirst({
    where: {
      txn_id: d.txnId,
      card_id: d.cardId,
      channel: d.channel,
    },
  });
  return t && { ...t, balance: await balanceOf(tx, t.card_id) };
}

// Same shape as a card payment from the event source, so the fraud detector reads all of them alike.
// createMany: no RETURNING, so no SELECT on the outbox.
function requested(t: transactions): Prisma.outboxCreateManyInput {
  const transfer = t.channel === 'TRANSFER';
  return {
    aggregate_type: REQUESTS_TOPIC,
    aggregate_id: t.card_id,
    type: 'TransactionRequested',
    payload: {
      txn_id: t.txn_id,
      ts: t.created_at.toISOString(),
      ts_epoch: t.created_at.getTime() / 1000,
      cc_num: t.card_id,
      channel: t.channel,
      merchant: transfer ? t.to_name : t.merchant,
      recipient_account: transfer ? `${OUR_BANK}:${t.to_account}` : null,
      category: transfer ? 'transfer' : t.category,
      amt: Number(t.amount),
      currency: 'VND',
      merch_lat: t.merch_lat,
      merch_long: t.merch_long,
    },
  };
}

// ts is the transaction's own time: the Cassandra sink finds the row the decision wrote by (card_id, ts).
function settled(t: transactions): Prisma.outboxCreateManyInput {
  return {
    aggregate_type: OUTCOMES_TOPIC,
    aggregate_id: t.card_id,
    type: t.status === 'POSTED' ? 'TransactionPosted' : 'TransactionDeclined',
    payload: {
      txn_id: t.txn_id,
      ts: t.created_at.toISOString(),
      cc_num: t.card_id,
      channel: t.channel,
      amt: Number(t.amount),
      reference: t.reference,
      status: t.status,
      declined_for: t.declined_for,
      settled_at: t.decided_at?.toISOString() ?? null,
    },
  };
}

async function balanceOf(tx: Pick<PrismaClient, 'accounts'>, cardId: string): Promise<bigint> {
  const { balance } = await tx.accounts.findUniqueOrThrow({
    where: { card_id: cardId },
    select: { balance: true },
  });
  return balance;
}

async function recipient(db: PrismaClient, t: TransferRequestInput): Promise<{ cardId: string; name: string }> {
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
  return {
    cardId: account.card_id,
    name: `${first_name} ${last_name}`.toUpperCase(),
  };
}

async function replay(tx: Tx, t: TransferRequestInput, amount: bigint): Promise<TransactionState> {
  const first = await tx.transactions.findUniqueOrThrow({
    where: { txn_id: t.transferId },
  });
  if (
    first.channel !== 'TRANSFER' ||
    first.card_id !== t.fromCard ||
    first.to_account !== t.toAccount ||
    first.amount !== amount
  ) {
    throw new TransferRefusedError('TRANSFER_ID_REUSED', 'transferId was already used for a different transfer');
  }
  return { ...first, balance: await balanceOf(tx, t.fromCard) };
}

async function replayPayment(tx: Tx, p: PaymentRequestInput, amount: bigint): Promise<TransactionState> {
  const first = await tx.transactions.findUniqueOrThrow({
    where: { txn_id: p.paymentId },
  });
  if (
    first.channel !== 'CARD' ||
    first.card_id !== p.fromCard ||
    first.merchant !== p.merchant ||
    first.amount !== amount
  ) {
    throw new TransferRefusedError('PAYMENT_ID_REUSED', 'paymentId was already used for a different payment');
  }
  return { ...first, balance: await balanceOf(tx, p.fromCard) };
}

// apply_ledger_entry() took the balance below zero: CHECK (balance >= 0) on accounts, SQLSTATE 23514.
function isOverdraft(e: unknown): boolean {
  const cause = postgresError(e);
  return cause?.originalCode === '23514' && !!cause.originalMessage?.includes('accounts_balance_check');
}

// forbid_frozen_sender() refused the transaction: SQLSTATE 55000 (object_not_in_prerequisite_state).
function isFrozenSender(e: unknown): boolean {
  return postgresError(e)?.originalCode === '55000';
}

// The card has no account: transactions_card_id_fkey, SQLSTATE 23503.
function isUnknownCard(e: unknown): boolean {
  const cause = postgresError(e);
  return cause?.originalCode === '23503' && !!cause.originalMessage?.includes('transactions_card_id_fkey');
}

// Prisma wraps a Postgres error; its own SQLSTATE and message are on the driver adapter's cause.
function postgresError(e: unknown): { originalCode?: string; originalMessage?: string } | undefined {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return (
    e.meta?.driverAdapterError as {
      cause?: { originalCode?: string; originalMessage?: string };
    }
  )?.cause;
}
