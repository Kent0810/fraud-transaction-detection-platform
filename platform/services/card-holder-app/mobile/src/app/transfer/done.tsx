import type Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInUp, PopIn } from '@/components/motion';
import { Button, Empty, IconBubble } from '@/components/ui';
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

type IconName = keyof typeof Ionicons.glyphMap;

const LOOK: Record<TransferStatus, (c: Colors) => { icon: IconName; title: string; tint: string; bg: string }> = {
  POSTED: (c) => ({ icon: 'checkmark', title: 'Transfer successful', tint: c.allow, bg: c.allowBg }),
  PENDING: (c) => ({ icon: 'hourglass-outline', title: 'Being checked', tint: c.stepUp, bg: c.stepUpBg }),
  DECLINED: (c) => ({ icon: 'close', title: 'Transfer declined', tint: c.decline, bg: c.declineBg }),
};

export default function TransferDoneScreen() {
  const c = useColors();
  const { transferId } = useLocalSearchParams<{ transferId: string }>();
  const { transfers, refreshTransfer } = useStore();
  const [checking, setChecking] = useState(false);
  const transfer = transfers.find((t) => t.transferId === transferId);

  if (!transfer) {
    return <Empty icon="receipt-outline" title="Transfer not found" detail="Check your recent transfers on Home." />;
  }

  const look = LOOK[transfer.status](c);
  const checkAgain = async () => {
    setChecking(true);
    await refreshTransfer(transfer.transferId).catch(() => null);
    setChecking(false);
  };

  const rows: [string, string][] = [
    ['Reference', transfer.reference],
    ['Recipient', transfer.to.name],
    ['Account', transfer.to.account],
    ['Bank', `${transfer.to.bank.code} · ${transfer.to.bank.name}`],
    ['Message', transfer.content],
    ['Fee', transfer.fee ? vnd(transfer.fee) : 'Free'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={[styles.receipt, { backgroundColor: c.surface }]}>
        <View style={styles.top}>
          <PopIn>
            <IconBubble name={look.icon} tint={look.tint} bg={look.bg} size={80} />
          </PopIn>
          <FadeInUp delay={200} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.status, { color: look.tint }]}>{look.title}</Text>
            <Text style={[styles.amount, { color: c.text }]}>{vnd(transfer.amount)}</Text>
            <Text style={[styles.words, { color: c.muted }]}>{vndInWords(transfer.amount)}</Text>
            <Text style={[styles.time, { color: c.muted }]}>{vnDateTime(transfer.ts)}</Text>
          </FadeInUp>
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

        <View style={styles.tear}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: c.bg }]} />
          <View style={[styles.dashes, { borderColor: c.border }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: c.bg }]} />
        </View>

        <FadeInUp delay={320}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
              <Text style={[styles.val, { color: k === 'Fee' ? c.allow : c.text }]}>{v}</Text>
            </View>
          ))}
        </FadeInUp>
      </View>

      <FadeInUp delay={450} style={styles.actions}>
        {transfer.status === 'PENDING' && (
          <Button
            label={checking ? 'Checking…' : 'Check again'}
            icon="refresh"
            variant="secondary"
            onPress={checkAgain}
            disabled={checking}
          />
        )}
        <Button label="Back to Home" onPress={() => router.dismissTo('/')} />
        <Button label="New transfer" variant="secondary" onPress={() => router.replace('/transfer')} />
      </FadeInUp>
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
  receipt: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden' },
  top: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  status: { fontSize: 16, fontWeight: '800' },
  amount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  words: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  time: { fontSize: 13, marginTop: 2 },
  note: { borderRadius: radius.md, padding: space.md, alignSelf: 'stretch' },
  noteText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  tear: { height: 24, justifyContent: 'center', marginHorizontal: -space.lg, marginVertical: space.sm },
  dashes: { marginHorizontal: space.lg, borderTopWidth: 1.5, borderStyle: 'dashed' },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: 10 },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  actions: { gap: space.sm },
});
