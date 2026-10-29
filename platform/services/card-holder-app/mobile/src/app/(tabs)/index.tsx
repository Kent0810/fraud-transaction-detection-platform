import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BankCard } from '@/components/BankCard';
import { category, day, greeting, money, relative } from '@/components/format';
import { Wordmark } from '@/components/Logo';
import { FadeInUp, ScalePressable, stagger } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { TxnRow } from '@/components/TxnRow';
import { SectionHeader, Surface } from '@/components/ui';
import { vnd } from '@/components/vnd';
import { useUser } from '@/data/auth';
import { useSettings } from '@/data/settings';
import { useStore } from '@/data/store';
import type { Txn } from '@/data/types';
import { radius, space, useColors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const RECENT_MERCHANTS = 2;

export default function HomeScreen() {
  const c = useColors();
  const { transactions, budget, frozen, alerts, balance, status, error, refresh } = useStore();
  const user = useUser();
  const { hideBalance, theme, update } = useSettings();
  const openAlerts = alerts.filter((a) => a.status === 'OPEN').length;

  // Latest approved payment to each of the two most recently paid merchants.
  const recentMerchants = useMemo(() => {
    const latest = new Map<string, Txn>();
    for (const t of [...transactions].sort((a, b) => b.ts.localeCompare(a.ts))) {
      if (t.decision !== 'DECLINE' && !latest.has(t.merchant)) latest.set(t.merchant, t);
      if (latest.size === RECENT_MERCHANTS) break;
    }
    return [...latest.values()];
  }, [transactions]);

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
    {
      icon: frozen ? 'snow' : 'snow-outline',
      label: frozen ? 'Unfreeze' : 'Freeze',
      onPress: () => router.push('/card/freeze'),
      active: frozen,
    },
    { icon: 'pie-chart-outline', label: 'Budget', onPress: () => router.navigate('/budget') },
    { icon: 'storefront-outline', label: 'Merchants', onPress: () => router.navigate('/merchants') },
  ];

  return (
    <Screen
      refreshControl={
        status === 'mock' ? undefined : (
          <RefreshControl refreshing={status === 'loading'} onRefresh={refresh} tintColor={c.primary} />
        )
      }
    >
      <FadeInUp>
        <View style={styles.brand}>
          <Wordmark size={26} />
        </View>
        <View style={styles.header}>
          <ScalePressable accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
            <Avatar name={user.name} size={44} />
          </ScalePressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hello, { color: c.muted }]}>{greeting()},</Text>
            <Text style={[styles.who, { color: c.text }]}>{user.name.split(' ')[0]}</Text>
          </View>
          <ScalePressable
            accessibilityLabel={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => update('theme', theme === 'dark' ? 'light' : 'dark')}
            style={[styles.bell, { backgroundColor: c.surface }]}
          >
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={c.text} />
          </ScalePressable>
          <ScalePressable
            accessibilityLabel="Alerts"
            onPress={() => router.navigate('/alerts')}
            style={[styles.bell, { backgroundColor: c.surface }]}
          >
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
            hitSlop={12}
          >
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
      </FadeInUp>

      {frozen && (
        <FadeInUp delay={120}>
          <Pressable
            onPress={() => router.push('/card/freeze')}
            accessibilityRole="button"
            accessibilityLabel="Card frozen. Unfreeze"
            style={[styles.frozen, { backgroundColor: c.primarySoft }]}
          >
            <Ionicons name="snow" size={20} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.frozenTitle, { color: c.text }]}>Card frozen</Text>
              <Text style={[styles.frozenDetail, { color: c.muted }]}>Card payments and transfers are blocked.</Text>
            </View>
            <Text style={[styles.frozenAction, { color: c.primary }]}>Unfreeze</Text>
          </Pressable>
        </FadeInUp>
      )}

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

      {recentMerchants.length > 0 && (
        <FadeInUp delay={360}>
          <SectionHeader title="Transfers" />
          <Surface style={styles.list}>
            {recentMerchants.map((t, i) => (
              <FadeInUp key={t.txnId} delay={stagger(i, 60, 420)}>
                <Pressable
                  onPress={() => router.push({ pathname: '/txn/[id]', params: { id: t.txnId } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.transfer,
                    i > 0 && [styles.divider, { borderTopColor: c.border }],
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Avatar name={t.merchant} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.transferName, { color: c.text }]} numberOfLines={1}>
                      {t.merchant}
                    </Text>
                    <Text style={[styles.transferMeta, { color: c.muted }]} numberOfLines={1}>
                      {category(t.category)} · {relative(t.ts)}
                    </Text>
                  </View>
                  <Text style={[styles.transferAmount, { color: c.text }]}>-{money(t.amount)}</Text>
                </Pressable>
              </FadeInUp>
            ))}
          </Surface>
        </FadeInUp>
      )}

      <FadeInUp delay={480}>
        <SectionHeader title="Recent activity" />
        {status === 'error' && (
          <Pressable
            onPress={refresh}
            style={[styles.banner, { backgroundColor: c.declineBg }]}
            accessibilityRole="button"
          >
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  hello: { fontSize: 14 },
  who: { fontSize: 18, fontWeight: '800' },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: space.lg },
  balanceLabel: { fontSize: 14 },
  balance: { fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  frozen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  frozenTitle: { fontSize: 15, fontWeight: '700' },
  frozenDetail: { fontSize: 13, marginTop: 2 },
  frozenAction: { fontSize: 14, fontWeight: '700' },
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
