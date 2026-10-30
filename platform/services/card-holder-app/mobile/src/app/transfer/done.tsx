import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Empty } from '@/components/ui';
import { vnd, vndInWords } from '@/components/vnd';
import { ruleTitle } from '@/data/rules';
import { useStore } from '@/data/store';
import type { TransferStatus } from '@/data/types';
import { radius, space, useColors, type Colors } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

function vnDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const LOOK: Record<TransferStatus, (c: Colors) => { title: string; tint: string; bg: string }> = {
  POSTED: (c) => ({ title: 'Transfer sent', tint: c.allow, bg: c.allowBg }),
  PENDING: (c) => ({ title: 'Being checked', tint: c.stepUp, bg: c.stepUpBg }),
  DECLINED: (c) => ({ title: 'Transfer declined', tint: c.decline, bg: c.declineBg }),
};

export default function TransferDoneScreen() {
  const c = useColors();
  const { transferId } = useLocalSearchParams<{ transferId: string }>();
  const { transfers, banks, refreshTransfer } = useStore();
  const [checking, setChecking] = useState(false);
  const transfer = transfers.find((t) => t.transferId === transferId);

  if (!transfer) {
    return <Empty title="Transfer not found" detail="Check your recent transfers on Home." />;
  }

  const look = LOOK[transfer.status](c);
  const checkAgain = async () => {
    setChecking(true);
    await refreshTransfer(transfer.transferId).catch(() => null);
    setChecking(false);
  };

  const bank = banks.find((b) => b.code === transfer.to.bankCode);
  const rows: [string, string][] = [
    ['Reference', transfer.reference],
    ['Recipient', transfer.to.name],
    ['Account', transfer.to.account],
    ['Bank', bank ? `${bank.code} · ${bank.name}` : transfer.to.bankCode],
    ['Message', transfer.content],
    ['Fee', transfer.fee ? vnd(transfer.fee) : 'Free'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={[styles.receipt, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.top}>
          <Text style={[styles.status, { color: look.tint }]}>{look.title}</Text>
          <Text style={[styles.amount, { color: c.text }]}>{vnd(transfer.amount)}</Text>
          <Text style={[styles.words, { color: c.muted }]}>{vndInWords(transfer.amount)}</Text>
          <Text style={[styles.time, { color: c.muted }]}>{vnDateTime(transfer.ts)}</Text>
          {transfer.status !== 'POSTED' && (
            <View style={[styles.note, { backgroundColor: look.bg }]}>
              <Text style={[styles.noteText, { color: c.text }]}>
                {transfer.status === 'PENDING'
                  ? 'Our fraud check is still looking at this transfer. No money has left your account yet.'
                  : `No money left your account. Reason: ${transfer.declinedFor.map(ruleTitle).join(', ')}.`}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: c.border }]} />

        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
            <Text style={[styles.val, { color: c.text }]}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {transfer.status === 'PENDING' && (
          <Button
            label={checking ? 'Checking…' : 'Check again'}
            variant="secondary"
            onPress={checkAgain}
            disabled={checking}
          />
        )}
        <Button label="Back to Home" onPress={() => router.dismissAll()} />
        <Button label="New transfer" variant="secondary" onPress={() => router.replace('/transfer')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    padding: space.lg,
    paddingTop: space.xxl * 1.5,
    paddingBottom: space.xxl,
    justifyContent: 'space-between',
    gap: space.xl,
  },
  receipt: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  top: { gap: 4, paddingBottom: space.sm },
  status: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  words: { fontSize: 13 },
  time: { fontSize: 13, marginTop: 2 },
  note: { borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  noteText: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: 10 },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  actions: { gap: space.sm },
});
