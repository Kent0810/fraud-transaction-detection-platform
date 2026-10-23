import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as commands from './commands';
import { apiEnabled } from './http';
import { type Controls, fetchAlerts, fetchControls, fetchTransactions } from './queries';
import { useUser } from './auth';

import { ALERTS, BANKS, BUDGET, LOOKUP_NAMES, MERCHANT_RULES, SAVED_RECIPIENTS, TRANSACTIONS } from './mock';
import type { Alert, Bank, Budget, MerchantRule, Period, Recipient, RuleType, Transfer, TransferKind, Txn } from './types';

export type TransferDraft = { kind: TransferKind; to: Recipient; amount: number; content: string; save: boolean };

export type DataStatus = 'mock' | 'loading' | 'ready' | 'error';

type Store = {
  status: DataStatus;
  error: string | null;
  cardId: string | null;
  refresh: () => void;
  transactions: Txn[];
  alerts: Alert[];
  budget: Budget;
  rules: MerchantRule[];
  frozen: boolean;
  balance: number;
  banks: Bank[];
  saved: Recipient[];
  transfers: Transfer[];
  draft: TransferDraft | null;
  toggleFrozen: () => void;
  setBudget: (limit: number, period: Period) => void;
  setMerchantRule: (merchant: string, type: RuleType) => void;
  releaseMerchant: (merchant: string) => void;
  ruleFor: (merchant: string) => MerchantRule | undefined;
  setDraft: (draft: TransferDraft | null) => void;
  lookupAccount: (bankCode: string, account: string) => Promise<string | null>;
  sendTransfer: (draft: TransferDraft) => Promise<Transfer>;
};

const StoreContext = createContext<Store | null>(null);

const PROPAGATION_MS = 1500;
const LOOKUP_MS = 700;
const TRANSFER_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CardData = { transactions: Txn[]; alerts: Alert[]; controls: Controls };

async function fetchCardData(cardId: string): Promise<CardData> {
  const [transactions, alerts, controls] = await Promise.all([fetchTransactions(cardId), fetchAlerts(cardId), fetchControls(cardId)]);
  return { transactions, alerts, controls };
}

const toRules = (controls: Controls): MerchantRule[] => controls.merchantRules.map((r) => ({ ...r, pending: false }));

const withControls = (budget: Budget, controls: Controls): Budget =>
  controls.budget ? { ...budget, limit: controls.budget.limit, period: controls.budget.period } : budget;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function StoreProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const cardId = user.cardId;
  const [budget, setBudgetState] = useState<Budget>(BUDGET);
  const [rules, setRules] = useState<MerchantRule[]>(apiEnabled ? [] : MERCHANT_RULES);
  const [frozen, setFrozen] = useState(false);
  const [balance, setBalance] = useState(user.balance);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [saved, setSaved] = useState<Recipient[]>(SAVED_RECIPIENTS);
  const [draft, setDraft] = useState<TransferDraft | null>(null);
  const [status, setStatus] = useState<DataStatus>(apiEnabled ? 'loading' : 'mock');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>(apiEnabled ? [] : TRANSACTIONS);
  const [alerts, setAlerts] = useState<Alert[]>(apiEnabled ? [] : ALERTS);

  const load = useCallback(() => {
    fetchCardData(cardId).then(
      (data) => {
        setTransactions(data.transactions);
        setAlerts(data.alerts);
        setRules(toRules(data.controls));
        setBudgetState((b) => withControls(b, data.controls));
        setError(null);
        setStatus('ready');
      },
      (e: unknown) => {
        setError(message(e));
        setStatus('error');
      },
    );
  }, [cardId]);

  const reloadControls = useCallback(() => {
    fetchControls(cardId).then(
      (controls) => {
        setRules(toRules(controls));
        setBudgetState((b) => withControls(b, controls));
      },
      (e: unknown) => setError(message(e)),
    );
  }, [cardId]);

  useEffect(() => {
    if (apiEnabled) load();
  }, [load]);

  const refresh = useCallback(() => {
    if (!apiEnabled) return;
    setStatus('loading');
    load();
  }, [load]);

  const effectiveBudget = useMemo<Budget>(() => {
    if (!apiEnabled) return budget;
    const now = new Date();
    const spent = transactions
      .filter((t) => t.decision !== 'DECLINE')
      .filter((t) => {
        const d = new Date(t.ts);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...budget, spent: Math.round(spent * 100) / 100 };
  }, [budget, transactions]);

  const toggleFrozen = useCallback(() => setFrozen((f) => !f), []);

  const setBudget = useCallback(
    (limit: number, period: Period) => {
      setBudgetState((b) => ({ ...b, limit, period }));
      if (apiEnabled) commands.setBudget(cardId, limit, period).catch(reloadControls);
    },
    [cardId, reloadControls],
  );

  const setMerchantRule = useCallback(
    (merchant: string, type: RuleType) => {
      setRules((rs) => [
        { merchant, type, createdAt: new Date().toISOString(), pending: true },
        ...rs.filter((r) => r.merchant !== merchant),
      ]);
      const settle = () => setRules((rs) => rs.map((r) => (r.merchant === merchant ? { ...r, pending: false } : r)));
      if (!apiEnabled) {
        setTimeout(settle, PROPAGATION_MS);
        return;
      }
      commands.setMerchantRule(cardId, merchant, type).then(settle, reloadControls);
    },
    [cardId, reloadControls],
  );

  const releaseMerchant = useCallback(
    (merchant: string) => {
      setRules((rs) => rs.filter((r) => r.merchant !== merchant));
      if (apiEnabled) commands.releaseMerchant(cardId, merchant).catch(reloadControls);
    },
    [cardId, reloadControls],
  );

  const lookupAccount = useCallback(
    async (bankCode: string, account: string) => {
      await wait(LOOKUP_MS);
      if (account.length < 6) return null;
      const known = saved.find((r) => r.bankCode === bankCode && r.account === account);
      if (known) return known.name;
      const sum = [...account].reduce((acc, d) => acc + Number(d), 0);
      return LOOKUP_NAMES[sum % LOOKUP_NAMES.length];
    },
    [saved],
  );

  const sendTransfer = useCallback(async (d: TransferDraft) => {
    await wait(TRANSFER_MS);
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const transfer: Transfer = {
      transferId: `FT${yy}${String(now.getTime()).slice(-9)}`,
      kind: d.kind,
      to: d.to,
      amount: d.amount,
      fee: 0,
      content: d.content,
      ts: now.toISOString(),
    };
    setTransfers((ts) => [transfer, ...ts]);
    setBalance((b) => b - d.amount);
    if (d.save) {
      setSaved((rs) =>
        rs.some((r) => r.bankCode === d.to.bankCode && r.account === d.to.account) ? rs : [d.to, ...rs],
      );
    }
    return transfer;
  }, []);

  const value = useMemo<Store>(
    () => ({
      status,
      error,
      cardId,
      refresh,
      transactions,
      alerts,
      budget: effectiveBudget,
      rules,
      frozen,
      balance,
      banks: BANKS,
      saved,
      transfers,
      draft,
      toggleFrozen,
      setBudget,
      setMerchantRule,
      releaseMerchant,
      ruleFor: (merchant) => rules.find((r) => r.merchant === merchant),
      setDraft,
      lookupAccount,
      sendTransfer,
    }),
    [status, error, cardId, refresh, transactions, alerts, effectiveBudget, rules, frozen, balance, saved, transfers, draft, toggleFrozen, setBudget, setMerchantRule, releaseMerchant, lookupAccount, sendTransfer],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return store;
}
