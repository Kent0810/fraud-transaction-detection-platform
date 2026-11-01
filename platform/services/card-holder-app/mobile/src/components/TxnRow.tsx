import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Txn } from '@/data/types';
import { space, useColors } from '@/theme';

import { category, categoryIcon, money, time } from './format';
import { IconBubble, StatusPill, useVerdictTone } from './ui';

export function TxnRow({ txn }: { txn: Txn }) {
  const c = useColors();
  // Declined by the fraud check, or approved but refused by the ledger (e.g. not enough balance).
  const declined = txn.decision === 'DECLINE' || txn.status === 'DECLINED';
  const flagged = txn.decision !== 'ALLOW' || declined;
  const tone = useVerdictTone()[declined ? 'DECLINE' : txn.decision];
  const received = txn.direction === 'IN';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/txn/[id]', params: { id: txn.txnId } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <IconBubble
        name={received ? 'arrow-down' : categoryIcon(txn.category)}
        tint={flagged ? tone.fg : received ? c.allow : c.primary}
        bg={flagged ? tone.bg : received ? c.allowBg : c.primarySoft}
      />
      <View style={styles.main}>
        <Text style={[styles.merchant, { color: c.text }]} numberOfLines={1}>
          {txn.merchant}
        </Text>
        <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>
          {received ? 'Received' : category(txn.category)} · {time(txn.ts)}
        </Text>
      </View>
      <View style={styles.side}>
        <Text
          style={[
            styles.amount,
            {
              color: declined ? c.muted : received ? c.allow : c.text,
              textDecorationLine: declined ? 'line-through' : 'none',
            },
          ]}
        >
          {received ? '+' : '-'}
          {money(txn.amount)}
        </Text>
        {flagged && <StatusPill decision={declined ? 'DECLINE' : txn.decision} compact />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  main: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 3 },
  side: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
