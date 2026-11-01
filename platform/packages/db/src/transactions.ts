import { bankByBin, OUR_BIN } from './banks';
import { isCardFrozen, verifyPassword } from './cards';
import { Prisma, type PrismaClient, type transactions } from './generated/prisma/client';

export const OUR_BANK = 'HCMMB';

const REQUESTS_TOPIC = 'transactions';
const OUTCOMES_TOPIC = 'settlements';
const CREDITS_TOPIC = 'credits';

export type TransactionStatus = 'PENDING' | 'HELD' | 'POSTED' | 'DECLINED';

/** How long a held transfer waits for an agent before it is declined. */
export const HOLD_MS = 24 * 60 * 60 * 1000;

export type HeldOutcome = 'CONFIRM' | 'REJECT';

type Channel = 'CARD' | 'TRANSFER';

export type TransferRequestInput = {
  fromCard: string;
  password: string;
  transferId: string;
  toBank?: string;
  toAccount: string;
  toName?: string;
  amount: number;
  content: string;
};

export type PaymentRequestInput = {
  fromCard: string;
  password: string;
  paymentId: string;
  merchant: string;
  category: string;
  amount: number;
  merchLat: number | null;
  merchLong: number | null;
};

export type DecisionInput = {
  txnId: string;
  cardId: string;
  channel: Channel;
  ts: string;
  merchant: string | null;
  category: string | null;
  amount: number;
  merchLat: number | null;
  merchLong: number | null;
  verdict: 'ALLOW' | 'STEP_UP' | 'DECLINE';
  firedRules: string[];
};

/** balance: what the card can spend now, its balance less any transfer held for an agent. */
export type TransactionState = transactions & { balance: bigint };

export type TransferRefusalCode =
  | 'CARD_FROZEN'
  | 'INCORRECT_PASSWORD'
  | 'ACCOUNT_NOT_FOUND'
  | 'OWN_ACCOUNT'
  | 'BANK_NOT_SUPPORTED'
  | 'NAME_REQUIRED'
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

type Outcome = 'POSTED' | 'DECLINED';
type Recipient = { cardId: string | null; bank: string | null; name: string };
type Reader = Pick<PrismaClient, 'transactions' | 'accounts'>;
type Tx = Pick<PrismaClient, 'transactions' | 'accounts' | 'ledger_entries'>;
type ReplayKey = 'channel' | 'card_id' | 'to_account' | 'to_bank' | 'merchant' | 'amount';

const refuse = (code: TransferRefusalCode, message: string) => new TransferRefusedError(code, message);
const frozen = () => refuse('CARD_FROZEN', 'your card is frozen');

export async function requestTransfer(db: PrismaClient, t: TransferRequestInput): Promise<TransactionState> {
  await checkSender(db, t.fromCard, t.password);
  const to = await recipient(db, t);
  const amount = BigInt(t.amount);
  await checkBalance(db, t.fromCard, amount);
  return record(db, t, to, amount);
}

export async function requestPayment(db: PrismaClient, p: PaymentRequestInput): Promise<TransactionState> {
  await checkSender(db, p.fromCard, p.password);
  const amount = BigInt(p.amount);
  await checkBalance(db, p.fromCard, amount);
  return recordPayment(db, p, amount);
}

export async function settle(db: PrismaClient, d: DecisionInput): Promise<TransactionState | null> {
  const approve = d.verdict === 'ALLOW';
  // A fraud mark never stops a payment by itself, and the cardholder sees these reasons: it stays between staff.
  const fired = d.firedRules.filter((r) => r !== 'FRAUD_RECIPIENT');
  const reasons = fired.length ? fired : [d.verdict];
  const run = d.channel === 'CARD' ? cardPayment(db, d) : transfer(db, d);

  // A stepped-up transfer waits for an agent instead of being declined.
  if (d.verdict === 'STEP_UP' && d.channel === 'TRANSFER') {
    try {
      const t = await hold(db, d);
      if (t !== NO_FUNDS) return t;
      return run('DECLINED', ['INSUFFICIENT_FUNDS']);
    } catch (e) {
      if (isFrozenSender(e)) return run('DECLINED', ['FROZEN']);
      throw e;
    }
  }
  if (!approve) {
    return run('DECLINED', reasons);
  }
  try {
    return await decide(db, d, 'POSTED', []);
  } catch (e) {
    if (isOverdraft(e)) return decide(db, d, 'DECLINED', ['INSUFFICIENT_FUNDS']);
    if (isFrozenSender(e)) return decide(db, d, 'DECLINED', ['FROZEN']);
    throw e;
  }
}

export function getTransfer(db: PrismaClient, fromCard: string, transferId: string): Promise<TransactionState | null> {
  return find(db, transferId, fromCard, 'TRANSFER');
}

export function getPayment(db: PrismaClient, fromCard: string, paymentId: string): Promise<TransactionState | null> {
  return find(db, paymentId, fromCard, 'CARD');
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
  return t && { ...t, balance: await availableBalance(db, fromCard) };
}

const frozen = () => new TransferRefusedError('CARD_FROZEN', 'your card is frozen');
const insufficientFunds = () => new TransferRefusedError('INSUFFICIENT_FUNDS', 'insufficient funds');

async function checkSender(db: PrismaClient, card: string, password: string): Promise<void> {
  if (await isCardFrozen(db, card)) throw frozen();
  if (!(await verifyPassword(db, card, password))) throw refuse('INCORRECT_PASSWORD', 'incorrect password');
}

// Not a hold: the balance is checked again when the money moves. Money held for an agent is not available.
async function checkBalance(db: PrismaClient, card: string, amount: bigint): Promise<void> {
  if ((await availableBalance(db, card)) < amount) {
    throw insufficientFunds();
  }
}

type Reader = Pick<PrismaClient, 'accounts' | 'transactions'>;

/** What the card can spend: its balance less every transfer held for an agent. */
export async function availableBalance(tx: Reader, cardId: string): Promise<bigint> {
  const [balance, held] = await Promise.all([
    balanceOf(tx, cardId),
    tx.transactions.aggregate({ where: { card_id: cardId, status: 'HELD' }, _sum: { amount: true } }),
  ]);
  return balance - (held._sum.amount ?? 0n);
}

// Serialises everything that spends from these accounts: posting, holding, resolving a hold, freezing. Taken first,
// before any other write, and in card_id order like postEntries, so A→B and B→A can't deadlock.
async function lockAccounts(tx: Pick<PrismaClient, '$queryRaw'>, cardIds: (string | null)[]): Promise<void> {
  const ids = [...new Set(cardIds.filter((id): id is string => !!id))].sort();
  await tx.$queryRaw`SELECT 1 FROM accounts WHERE card_id = ANY(${ids}) ORDER BY card_id FOR UPDATE`;
}

// The accounts a transaction writes to when it posts: the payer, and the recipient when it is one of our cards.
async function lockFor(tx: Prisma.TransactionClient, d: { txnId: string; cardId: string }): Promise<void> {
  const t = await tx.transactions.findFirst({
    where: { txn_id: d.txnId, card_id: d.cardId },
    select: { to_card: true },
  });
  await lockAccounts(tx, [d.cardId, t?.to_card ?? null]);
}

// Posting this would spend money held for an agent. settle() declines it like an overdraft.
class HeldFundsError extends Error {
  constructor() {
    super('insufficient available funds');
    this.name = 'HeldFundsError';
  }
}

// Before posting t, with its accounts locked: the card can cover it without the money held for an agent.
async function checkAvailable(tx: Prisma.TransactionClient, t: transactions): Promise<void> {
  if ((await availableBalance(tx, t.card_id)) < t.amount) throw new HeldFundsError();
}

const NO_FUNDS = Symbol('no funds');

// PENDING → HELD, unless the card can't cover it on top of what is already held.
function hold(db: PrismaClient, d: DecisionInput): Promise<TransactionState | null | typeof NO_FUNDS> {
  return db.$transaction(async (tx) => {
    await lockAccounts(tx, [d.cardId]);
    const pending = await tx.transactions.findFirst({
      where: { txn_id: d.txnId, card_id: d.cardId, channel: 'TRANSFER', status: 'PENDING' },
    });
    if (!pending) return current(tx, d);
    if ((await availableBalance(tx, d.cardId)) < pending.amount) return NO_FUNDS;

    const [t] = await tx.transactions.updateManyAndReturn({
      where: { txn_id: d.txnId, card_id: d.cardId, channel: 'TRANSFER', status: 'PENDING' },
      data: { status: 'HELD', held_until: new Date(Date.now() + HOLD_MS) },
    });
    if (!t) return current(tx, d);
    await tx.outbox.createMany({ data: settled(t) });
    return { ...t, balance: await availableBalance(tx, t.card_id) };
  });
}

// HELD → POSTED or DECLINED, once. Null when it is no longer HELD.
async function finishHeld(
  tx: Prisma.TransactionClient,
  t: transactions,
  status: Outcome,
  reasons: string[],
): Promise<TransactionState | null> {
  const [done] = await tx.transactions.updateManyAndReturn({
    where: { txn_id: t.txn_id, card_id: t.card_id, status: 'HELD' },
    data: { status, declined_for: reasons, decided_at: new Date(), held_until: null },
  });
  if (!done) return null;
  if (status === 'POSTED') await postEntries(tx, done);
  const events = [settled(done)];
  if (status === 'POSTED' && done.to_card) events.push(await credited(tx, done, done.to_card));
  await tx.outbox.createMany({ data: events });
  return { ...done, balance: await availableBalance(tx, done.card_id) };
}

/**
 * An agent's answer on a held transfer, inside the caller's transaction. CONFIRM posts it, unless the card is frozen
 * or can no longer cover it; REJECT declines it. Null when the transfer is no longer HELD (already resolved).
 */
export async function resolveHeld(
  tx: Prisma.TransactionClient,
  cardId: string,
  txnId: string,
  outcome: HeldOutcome,
): Promise<TransactionState | null> {
  await lockFor(tx, { txnId, cardId });
  const t = await tx.transactions.findFirst({
    where: { txn_id: txnId, card_id: cardId, channel: 'TRANSFER', status: 'HELD' },
  });
  if (!t) return null;
  if (outcome === 'REJECT') return finishHeld(tx, t, 'DECLINED', ['REJECTED_BY_BANK']);

  const { status } = await tx.accounts.findUniqueOrThrow({ where: { card_id: cardId }, select: { status: true } });
  if (status === 'FROZEN') return finishHeld(tx, t, 'DECLINED', ['FROZEN']);
  // Available still counts this transfer as held, and that held amount is the money being spent now.
  if ((await availableBalance(tx, cardId)) < 0n) {
    return finishHeld(tx, t, 'DECLINED', ['INSUFFICIENT_FUNDS']);
  }
  return finishHeld(tx, t, 'POSTED', []);
}

/** Declines every transfer the card has held, inside the caller's transaction (a freeze). Returns how many. */
export async function declineHeld(tx: Prisma.TransactionClient, cardId: string, reason: 'FROZEN'): Promise<number> {
  const held = await tx.transactions.findMany({ where: { card_id: cardId, status: 'HELD' } });
  let n = 0;
  for (const t of held) {
    if (await finishHeld(tx, t, 'DECLINED', [reason])) n++;
  }
  return n;
}

/** Declines every held transfer whose time ran out, each in its own transaction. Returns how many. */
export async function expireHeld(db: PrismaClient, now: Date = new Date()): Promise<number> {
  const due = await db.transactions.findMany({ where: { status: 'HELD', held_until: { lt: now } } });
  let n = 0;
  for (const t of due) {
    const done = await db.$transaction((tx) => finishHeld(tx, t, 'DECLINED', ['NOT_CONFIRMED']));
    if (done) n++;
  }
  return n;
}

type Outcome = 'POSTED' | 'DECLINED';
type Settle = (status: Outcome, reasons: string[]) => Promise<TransactionState | null>;

type Recipient = { cardId: string | null; bank: string | null; name: string };

function record(db: PrismaClient, t: TransferRequestInput, to: Recipient, amount: bigint): Promise<TransactionState> {
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
          to_bank: to.bank,
          amount,
          content: t.content,
        },
      ],
      skipDuplicates: true,
    });
    if (!created) return replay(tx, t, amount);

    await tx.outbox.createMany({ data: requested(created) });
    return { ...created, balance: await availableBalance(tx, t.fromCard) };
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
    return { ...created, balance: await availableBalance(tx, p.fromCard) };
  });
}

// A transfer was recorded PENDING by requestTransfer(); the decision moves it on, once.
function transfer(db: PrismaClient, d: DecisionInput): Settle {
  return (status, reasons) =>
    db.$transaction(async (tx) => {
      await lockFor(tx, d);
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
      const t = pending ?? (d.channel === 'CARD' ? await recordDecided(tx, d, status, reasons) : undefined);
      if (!t) return find(tx, d.txnId, d.cardId, d.channel);

      if (status === 'POSTED') {
        await checkAvailable(tx, t);
        await postEntries(tx, t);
      }
      const events = [settled(t)];
      if (status === 'POSTED') {
        await postEntries(tx, t);
        if (t.to_card) events.push(await credited(tx, t, t.to_card));
      }
      await tx.outbox.createMany({ data: events });
      return { ...t, balance: await availableBalance(tx, t.card_id) };
    });
  } catch (e) {
    if (isUnknownCard(e)) return null;
    throw e;
  }
}

// A card payment made in the app was recorded PENDING by requestPayment() and is decided like a transfer. One from the
// event source is recorded only now, already decided, together with its entry and outcome.
function cardPayment(db: PrismaClient, d: DecisionInput): Settle {
  return async (status, reasons) => {
    try {
      return await db.$transaction(async (tx) => {
        await lockAccounts(tx, [d.cardId]);
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

        if (status === 'POSTED') {
          await checkAvailable(tx, t);
          await postEntries(tx, t);
        }
        await tx.outbox.createMany({ data: settled(t) });
        return { ...t, balance: await availableBalance(tx, t.card_id) };
      });
    } catch (e) {
      if (isUnknownCard(e)) return null;
      throw e;
    }
  };
}

async function postEntries(tx: Tx, t: transactions): Promise<void> {
  const kind = t.channel === 'CARD' ? 'CARD_PAYMENT' : 'TRANSFER';
  const entries = [{ card_id: t.card_id, kind, amount: -t.amount, reference: t.reference }];
  if (t.to_card) entries.push({ card_id: t.to_card, kind, amount: t.amount, reference: t.reference });
  entries.sort((a, b) => (a.card_id < b.card_id ? -1 : 1));
  await tx.ledger_entries.createMany({ data: entries });
}

async function current(tx: Tx, d: DecisionInput): Promise<TransactionState | null> {
  const t = await tx.transactions.findFirst({
    where: {
      txn_id: d.txnId,
      card_id: d.cardId,
      channel: d.channel,
    },
  });
  return t && { ...t, balance: await availableBalance(tx, t.card_id) };
}

function requested(t: transactions): Prisma.outboxCreateManyInput {
  const transfer = t.channel === 'TRANSFER';
  const bank = t.to_bank ? (bankByBin(t.to_bank)?.code ?? t.to_bank) : OUR_BANK;
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
      recipient_account: transfer ? `${bank}:${t.to_account}` : null,
      category: transfer ? 'transfer' : t.category,
      amt: Number(t.amount),
      currency: 'VND',
      merch_lat: t.merch_lat,
      merch_long: t.merch_long,
    },
  };
}

function settled(t: transactions): Prisma.outboxCreateManyInput {
  return {
    aggregate_type: OUTCOMES_TOPIC,
    aggregate_id: t.card_id,
    type: t.status === 'POSTED' ? 'TransactionPosted' : t.status === 'HELD' ? 'TransactionHeld' : 'TransactionDeclined',
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

async function credited(
  tx: Pick<PrismaClient, 'accounts'>,
  t: transactions,
  toCard: string,
): Promise<Prisma.outboxCreateManyInput> {
  const sender = await tx.accounts.findUniqueOrThrow({
    where: { card_id: t.card_id },
    select: { account_number: true, cardholders: { select: { first_name: true, last_name: true } } },
  });
  return {
    aggregate_type: CREDITS_TOPIC,
    aggregate_id: toCard,
    type: 'TransferReceived',
    payload: {
      txn_id: t.txn_id,
      ts: t.created_at.toISOString(),
      cc_num: toCard,
      channel: 'TRANSFER',
      direction: 'IN',
      merchant: fullName(sender.cardholders),
      recipient_account: `${OUR_BANK}:${sender.account_number}`,
      category: 'transfer',
      amount: Number(t.amount),
      currency: 'VND',
      decision: 'ALLOW',
      status: 'POSTED',
      settled_at: t.decided_at?.toISOString() ?? null,
      reference: t.reference,
      content: t.content,
    },
  };
}

async function recipient(db: PrismaClient, t: TransferRequestInput): Promise<Recipient> {
  if (t.toBank && t.toBank !== OUR_BIN) {
    if (!bankByBin(t.toBank)) throw refuse('BANK_NOT_SUPPORTED', 'transfers to this bank are not supported');
    const name = t.toName?.trim().toUpperCase();
    if (!name) throw refuse('NAME_REQUIRED', "the recipient's name is required for another bank");
    return { cardId: null, bank: t.toBank, name };
  }
  const account = await db.accounts.findUnique({
    where: { account_number: t.toAccount },
    select: { card_id: true, cardholders: { select: { first_name: true, last_name: true } } },
  });
  if (!account) throw refuse('ACCOUNT_NOT_FOUND', 'account not found');
  if (account.card_id === t.fromCard) throw refuse('OWN_ACCOUNT', 'cannot transfer to your own account');
  return { cardId: account.card_id, bank: null, name: fullName(account.cardholders) };
}

async function replay(tx: Tx, t: TransferRequestInput, amount: bigint): Promise<TransactionState> {
  const first = await tx.transactions.findUniqueOrThrow({
    where: { txn_id: t.transferId },
  });
  if (
    first.channel !== 'TRANSFER' ||
    first.card_id !== t.fromCard ||
    first.to_account !== t.toAccount ||
    first.to_bank !== (t.toBank && t.toBank !== OUR_BIN ? t.toBank : null) ||
    first.amount !== amount
  ) {
    throw new TransferRefusedError('TRANSFER_ID_REUSED', 'transferId was already used for a different transfer');
  }
  return { ...first, balance: await availableBalance(tx, t.fromCard) };
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
  return { ...first, balance: await availableBalance(tx, p.fromCard) };
}

// apply_ledger_entry() took the balance below zero: CHECK (balance >= 0) on accounts, SQLSTATE 23514.
function isOverdraft(e: unknown): boolean {
  if (e instanceof HeldFundsError) return true;
  const cause = postgresError(e);
  return cause?.originalCode === '23514' && !!cause.originalMessage?.includes('accounts_balance_check');
}

function isFrozenSender(e: unknown): boolean {
  return postgresError(e)?.originalCode === '55000';
}

function isUnknownCard(e: unknown): boolean {
  const cause = postgresError(e);
  return cause?.originalCode === '23503' && !!cause.originalMessage?.includes('transactions_card_id_fkey');
}

function postgresError(e: unknown): { originalCode?: string; originalMessage?: string } | undefined {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return (e.meta?.driverAdapterError as { cause?: { originalCode?: string; originalMessage?: string } })?.cause;
}
