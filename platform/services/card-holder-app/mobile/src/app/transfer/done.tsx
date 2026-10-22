import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInUp, PopIn } from '@/components/motion';
import { Button, Empty, IconBubble } from '@/components/ui';
import { vnd, vndInWords } from '@/components/vnd';
import { useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

// "14:32 · 22/10/2026"
function vnDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// The receipt after a successful transfer.
export default function TransferDoneScreen() {
  const c = useColors();
  const { transferId } = useLocalSearchParams<{ transferId: string }>();
  const { transfers, banks } = useStore();
  const transfer = transfers.find((t) => t.transferId === transferId);

  if (!transfer) {
    return <Empty icon="receipt-outline" title="Transfer not found" detail="Check your recent transfers on Home." />;
  }

  const bank = banks.find((b) => b.code === transfer.to.bankCode);
  const rows: [string, string][] = [
    ['Reference', transfer.transferId],
    ['Recipient', transfer.to.name],
    ['Account', transfer.to.account],
    ['Bank', bank ? `${bank.code} · ${bank.name}` : transfer.to.bankCode],
    ['Message', transfer.content],
    ['Fee', transfer.fee ? vnd(transfer.fee) : 'Free'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={[styles.receipt, { backgroundColor: c.surface }]}>
        <View style={styles.top}>
          <PopIn>
            <IconBubble name="checkmark" tint={c.allow} bg={c.allowBg} size={80} />
          </PopIn>
          <FadeInUp delay={200} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.status, { color: c.allow }]}>Transfer successful</Text>
            <Text style={[styles.amount, { color: c.text }]}>{vnd(transfer.amount)}</Text>
            <Text style={[styles.words, { color: c.muted }]}>{vndInWords(transfer.amount)}</Text>
            <Text style={[styles.time, { color: c.muted }]}>{vnDateTime(transfer.ts)}</Text>
          </FadeInUp>
        </View>

        {/* Ticket-style tear line with notches on both sides. */}
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
        <Button label="Back to Home" onPress={() => router.dismissAll()} />
        <Button label="New transfer" variant="secondary" onPress={() => router.replace('/transfer')} />
      </FadeInUp>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: space.lg, paddingTop: space.xxl * 1.5, paddingBottom: space.xxl, justifyContent: 'space-between', gap: space.xl },
  receipt: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden' },
  top: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  status: { fontSize: 16, fontWeight: '800' },
  amount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  words: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  time: { fontSize: 13, marginTop: 2 },
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
