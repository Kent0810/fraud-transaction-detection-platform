import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BankCard } from '@/components/BankCard';
import { day } from '@/components/format';
import { Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { TxnRow } from '@/components/TxnRow';
import { Button, SectionHeader, Surface } from '@/components/ui';
import { vnd } from '@/components/vnd';
import { useUser } from '@/data/auth';
import { useSettings } from '@/data/settings';
import { useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

export default function HomeScreen() {
  const c = useColors();
  const { transactions, budget, frozen, alerts, balance, status, error, refresh } = useStore();
  const user = useUser();
  const { hideBalance, update } = useSettings();
  const openAlerts = alerts.filter((a) => a.status === 'OPEN').length;

  const sections = useMemo(() => {
    const byDay = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const key = day(t.ts);
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    return [...byDay];
  }, [transactions]);

  return (
    <Screen
      refreshControl={
        status === 'mock' ? undefined : (
          <RefreshControl refreshing={status === 'loading'} onRefresh={refresh} tintColor={c.muted} />
        )
      }
    >
      <View style={styles.header}>
        <Wordmark size={24} />
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="Alerts" onPress={() => router.navigate('/alerts')} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={c.text} />
            {openAlerts > 0 && <View style={[styles.dot, { backgroundColor: c.decline, borderColor: c.bg }]} />}
          </Pressable>
          <Pressable accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
            <Avatar name={user.name} size={32} />
          </Pressable>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View>
          <Text style={[styles.balanceLabel, { color: c.muted }]}>Available balance</Text>
          <Text style={[styles.balance, { color: c.text }]}>{hideBalance ? '•••••• đ' : vnd(balance)}</Text>
        </View>
        <Pressable
          onPress={() => update('hideBalance', !hideBalance)}
          accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
          hitSlop={12}
        >
          <Ionicons name={hideBalance ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
        </Pressable>
      </View>

      <BankCard
        last4={user.cardId.slice(-4)}
        spent={budget.spent}
        limit={budget.limit}
        period={budget.period}
        frozen={frozen}
      />

      {frozen && (
        <Pressable
          onPress={() => router.push('/card/freeze')}
          accessibilityRole="button"
          accessibilityLabel="Card frozen. Unfreeze"
          style={[styles.frozen, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={[styles.frozenDetail, { color: c.text }]}>
            Card frozen. Card payments and transfers are blocked.
          </Text>
          <Text style={[styles.frozenAction, { color: c.text }]}>Unfreeze</Text>
        </Pressable>
      )}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Transfer" onPress={() => router.push('/transfer')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={frozen ? 'Unfreeze card' : 'Freeze card'}
            variant="secondary"
            onPress={() => router.push('/card/freeze')}
          />
        </View>
      </View>

      <SectionHeader title="Recent activity" />
      {status === 'error' && (
        <Pressable
          onPress={refresh}
          style={[styles.banner, { backgroundColor: c.declineBg }]}
          accessibilityRole="button"
        >
          <Text style={[styles.bannerTitle, { color: c.decline }]}>Could not load your activity</Text>
          <Text style={[styles.bannerDetail, { color: c.muted }]} numberOfLines={2}>
            {error} · Tap to retry
          </Text>
        </Pressable>
      )}
      {status === 'ready' && transactions.length === 0 && (
        <Text style={[styles.empty, { color: c.muted }]}>No card payments yet.</Text>
      )}
      {sections.map(([title, txns]) => (
        <View key={title} style={{ marginBottom: space.lg }}>
          <Text style={[styles.day, { color: c.muted }]}>{title}</Text>
          <Surface style={styles.list}>
            {txns.map((t, i) => (
              <View key={t.txnId} style={i > 0 && [styles.divider, { borderTopColor: c.border }]}>
                <TxnRow txn={t} />
              </View>
            ))}
          </Surface>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xl },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  dot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: space.lg },
  balanceLabel: { fontSize: 14 },
  balance: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  frozen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
  },
  frozenDetail: { flex: 1, fontSize: 14 },
  frozenAction: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  day: { fontSize: 13, marginBottom: space.xs },
  list: { paddingVertical: 0 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  banner: { padding: space.md, borderRadius: radius.md, marginBottom: space.md },
  bannerTitle: { fontSize: 15, fontWeight: '600' },
  bannerDetail: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, paddingVertical: space.lg },
});
