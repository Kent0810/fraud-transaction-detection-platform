import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { money, relative } from '@/components/format';
import { Screen } from '@/components/Screen';
import { Empty, Pill, ScreenTitle, Surface } from '@/components/ui';
import { RULE_TEXT, ruleTitle } from '@/data/rules';
import { useStore } from '@/data/store';
import type { AlertStatus } from '@/data/types';
import { radius, space, useColors } from '@/theme';

type Filter = 'OPEN' | 'ALL';

export default function AlertsScreen() {
  const c = useColors();
  const { alerts } = useStore();
  const [filter, setFilter] = useState<Filter>('OPEN');
  const shown = filter === 'OPEN' ? alerts.filter((a) => a.status === 'OPEN') : alerts;

  const tone: Record<AlertStatus, { label: string; fg: string; bg: string }> = {
    OPEN: { label: 'Needs review', fg: c.decline, bg: c.declineBg },
    CONFIRMED: { label: 'Confirmed fraud', fg: c.decline, bg: c.declineBg },
    CLEARED: { label: 'Cleared', fg: c.allow, bg: c.allowBg },
  };

  return (
    <Screen>
      <ScreenTitle title="Alerts" />

      <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {(['OPEN', 'ALL'] as Filter[]).map((f) => {
          const on = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.segmentItem, on && { backgroundColor: c.surface }]}
            >
              <Text style={[styles.segmentText, { color: on ? c.text : c.muted }]}>
                {f === 'OPEN' ? 'Needs review' : 'All alerts'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length === 0 ? (
        <Empty title="Nothing to review" detail="We'll notify you if a payment looks unusual." />
      ) : (
        <Surface style={styles.list}>
          {shown.map((a, i) => {
            const t = tone[a.status];
            return (
              <Pressable
                key={`${filter}-${a.alertId}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/txn/[id]', params: { id: a.txnId } })}
                style={({ pressed }) => [
                  styles.alert,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.head}>
                    <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                      {ruleTitle(a.ruleId)}
                    </Text>
                    <Text style={[styles.when, { color: c.muted }]}>{relative(a.ts)}</Text>
                  </View>
                  <Text style={[styles.detail, { color: c.muted }]}>
                    <Text style={{ color: c.text }}>{money(a.amount)}</Text> at {a.merchant}.{' '}
                    {RULE_TEXT[a.ruleId]?.detail}
                  </Text>
                  <Pill label={t.label} fg={t.fg} bg={t.bg} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </Pressable>
            );
          })}
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3, marginBottom: space.lg },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md - 2 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  list: { paddingVertical: 0 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  when: { fontSize: 12 },
  detail: { fontSize: 14, lineHeight: 20 },
});
