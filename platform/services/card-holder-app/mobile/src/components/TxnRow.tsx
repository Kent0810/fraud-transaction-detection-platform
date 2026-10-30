import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Txn } from '@/data/types';
import { space, useColors } from '@/theme';

import { category, money, time } from './format';
import { StatusPill } from './ui';

export function TxnRow({ txn }: { txn: Txn }) {
  const c = useColors();
  const declined = txn.decision === 'DECLINE';
  const flagged = txn.decision !== 'ALLOW';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/txn/[id]', params: { id: txn.txnId } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.main}>
        <Text style={[styles.merchant, { color: c.text }]} numberOfLines={1}>
          {txn.merchant}
        </Text>
        <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>
          {category(txn.category)} · {time(txn.ts)}
        </Text>
      </View>
      <View style={styles.side}>
        <Text
          style={[
            styles.amount,
            { color: declined ? c.muted : c.text, textDecorationLine: declined ? 'line-through' : 'none' },
          ]}
        >
          -{money(txn.amount)}
        </Text>
        {flagged && <StatusPill decision={txn.decision} compact />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  main: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, marginTop: 2 },
  side: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
