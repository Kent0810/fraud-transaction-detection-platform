import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BankCard } from '@/components/BankCard';
import { day, greeting, relative } from '@/components/format';
import { FadeInUp, ScalePressable, stagger } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { TxnRow } from '@/components/TxnRow';
import { UserSwitcher } from '@/components/UserSwitcher';
import { SectionHeader, Surface } from '@/components/ui';
import { vnd } from '@/components/vnd';
import { useSettings, useUser } from '@/data/settings';
import { useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Home: card, quick actions and transaction history (reads txn_by_card, newest first).
export default function HomeScreen() {
  const c = useColors();
  const { transactions, budget, frozen, toggleFrozen, alerts, balance, transfers, status, error, refresh } = useStore();
  const user = useUser();
  const [switching, setSwitching] = useState(false);
  const { hideBalance, theme, update } = useSettings();
  const openAlerts = alerts.filter((a) => a.status === 'OPEN').length;

  const sections = useMemo(() => {
    const byDay = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const key = day(t.ts);
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    return [...byDay];
  }, [transactions]);

  const actions: { icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    { icon: 'paper-plane-outline', label: 'Transfer', onPress: () => router.push('/transfer') },
    { icon: frozen ? 'snow' : 'snow-outline', label: frozen ? 'Unfreeze' : 'Freeze', onPress: toggleFrozen, active: frozen },
    { icon: 'pie-chart-outline', label: 'Budget', onPress: () => router.navigate('/budget') },
    { icon: 'storefront-outline', label: 'Merchants', onPress: () => router.navigate('/merchants') },
  ];

  return (
    <Screen
      refreshControl={
        status === 'mock' ? undefined : (
          <RefreshControl refreshing={status === 'loading'} onRefresh={refresh} tintColor={c.primary} />
        )
      }>
      <FadeInUp>
        <View style={styles.header}>
          <ScalePressable accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
            <Avatar name={user.name} size={44} />
          </ScalePressable>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setSwitching(true)}
            accessibilityRole="button"
            accessibilityLabel="Switch account">
            <Text style={[styles.hello, { color: c.muted }]}>{greeting()},</Text>
            <View style={styles.whoRow}>
              <Text style={[styles.who, { color: c.text }]}>{user.name.split(' ')[0]}</Text>
              <Ionicons name="chevron-down" size={18} color={c.muted} />
            </View>
          </Pressable>
          <ScalePressable
            accessibilityLabel={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => update('theme', theme === 'dark' ? 'light' : 'dark')}
            style={[styles.bell, { backgroundColor: c.surface }]}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={c.text} />
          </ScalePressable>
          <ScalePressable
            accessibilityLabel="Alerts"
            onPress={() => router.navigate('/alerts')}
            style={[styles.bell, { backgroundColor: c.surface }]}>
            <Ionicons name="notifications-outline" size={22} color={c.text} />
            {openAlerts > 0 && <View style={[styles.dot, { backgroundColor: c.decline, borderColor: c.surface }]} />}
          </ScalePressable>
        </View>

        <View style={styles.balanceRow}>
          <View>
            <Text style={[styles.balanceLabel, { color: c.muted }]}>Available balance</Text>
            <Text style={[styles.balance, { color: c.text }]}>{hideBalance ? '•••••• đ' : vnd(balance)}</Text>
          </View>
          <Pressable
            onPress={() => update('hideBalance', !hideBalance)}
            accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
            hitSlop={12}>
            <Ionicons name={hideBalance ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.muted} />
          </Pressable>
        </View>
      </FadeInUp>

      <FadeInUp delay={80} distance={28}>
        <BankCard
          last4={user.cardId.slice(-4)}
          holder={user.name}
          spent={budget.spent}
          limit={budget.limit}
          period={budget.period}
          frozen={frozen}
        />
        <Text style={[styles.hint, { color: c.muted }]}>Tap the card to flip it</Text>
      </FadeInUp>

      <View style={styles.actions}>
        {actions.map((a, i) => (
          <FadeInUp key={a.label} delay={stagger(i, 60, 160)}>
            <ScalePressable onPress={a.onPress} accessibilityRole="button" style={styles.action} scaleTo={0.9}>
              <View style={[styles.actionIcon, { backgroundColor: a.active ? c.primary : c.surface }]}>
                <Ionicons name={a.icon} size={22} color={a.active ? c.onPrimary : c.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
            </ScalePressable>
          </FadeInUp>
        ))}
      </View>

      {transfers.length > 0 && (
        <FadeInUp delay={360}>
          <SectionHeader title="Transfers" />
          <Surface style={styles.list}>
            {transfers.slice(0, 3).map((t, i) => {
              return (
                <FadeInUp key={t.transferId} delay={stagger(i, 60, 420)}>
                  <View style={[styles.transfer, i > 0 && [styles.divider, { borderTopColor: c.border }]]}>
                    <Avatar name={t.to.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.transferName, { color: c.text }]} numberOfLines={1}>
                        {t.to.name}
                      </Text>
                      <Text style={[styles.transferMeta, { color: c.muted }]} numberOfLines={1}>
                        {t.to.bankCode} · {relative(t.ts)}
                      </Text>
                    </View>
                    <Text style={[styles.transferAmount, { color: c.text }]}>-{vnd(t.amount)}</Text>
                  </View>
                </FadeInUp>
              );
            })}
          </Surface>
        </FadeInUp>
      )}

      <FadeInUp delay={480}>
        <SectionHeader title="Recent activity" />
        {status === 'error' && (
          <Pressable onPress={refresh} style={[styles.banner, { backgroundColor: c.declineBg }]} accessibilityRole="button">
            <Ionicons name="cloud-offline-outline" size={20} color={c.decline} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: c.decline }]}>Could not load your activity</Text>
              <Text style={[styles.bannerDetail, { color: c.muted }]} numberOfLines={2}>
                {error} · Tap to retry
              </Text>
            </View>
          </Pressable>
        )}
        {status === 'ready' && transactions.length === 0 && (
          <Text style={[styles.empty, { color: c.muted }]}>No card payments yet.</Text>
        )}
      </FadeInUp>
      {sections.map(([title, txns], s) => (
        <FadeInUp key={title} delay={stagger(s, 80, 520)} style={{ marginBottom: space.lg }}>
          <Text style={[styles.day, { color: c.muted }]}>{title}</Text>
          <Surface style={styles.list}>
            {txns.map((t, i) => (
              <FadeInUp key={t.txnId} delay={stagger(i, 45, 560)} distance={10}>
                <View style={i > 0 && [styles.divider, { borderTopColor: c.border }]}>
                  <TxnRow txn={t} />
                </View>
              </FadeInUp>
            ))}
          </Surface>
        </FadeInUp>
      ))}
      <UserSwitcher visible={switching} onClose={() => setSwitching(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  hello: { fontSize: 14 },
  who: { fontSize: 18, fontWeight: '800' },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: space.lg },
  balanceLabel: { fontSize: 14 },
  balance: { fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, textAlign: 'center', marginTop: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  action: { alignItems: 'center', gap: space.sm, width: 72 },
  actionIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600' },
  day: { fontSize: 13, fontWeight: '600', marginBottom: space.sm, marginLeft: space.xs },
  list: { paddingVertical: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerDetail: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: space.lg },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  transferName: { fontSize: 16, fontWeight: '600' },
  transferMeta: { fontSize: 13, marginTop: 3 },
  transferAmount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
