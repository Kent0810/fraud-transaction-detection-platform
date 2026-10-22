import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { money, relative } from '@/components/format';
import { FadeInUp, ScalePressable, stagger } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Empty, IconBubble, Pill, ScreenTitle, Surface } from '@/components/ui';
import { RULE_TEXT, ruleTitle } from '@/data/rules';
import { useStore } from '@/data/store';
import type { AlertStatus } from '@/data/types';
import { radius, space, useColors } from '@/theme';

type Filter = 'OPEN' | 'ALL';

// Alerts: reads alerts_by_card. New ones also arrive as push from the notifier.
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
      <ScreenTitle title="Alerts" subtitle="Security" />

      <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {(['OPEN', 'ALL'] as Filter[]).map((f) => {
          const on = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.segmentItem, on && { backgroundColor: c.surface }]}>
              <Text style={[styles.segmentText, { color: on ? c.text : c.muted }]}>
                {f === 'OPEN' ? 'Needs review' : 'All alerts'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length === 0 ? (
        <Empty icon="shield-checkmark" title="All clear" detail="We'll notify you right away if something looks unusual." />
      ) : (
        <View style={{ gap: space.md }}>
          {shown.map((a, i) => {
            const t = tone[a.status];
            return (
              <FadeInUp key={`${filter}-${a.alertId}`} delay={stagger(i, 60)}>
              <ScalePressable
                accessibilityRole="button"
                scaleTo={0.97}
                onPress={() => router.push({ pathname: '/txn/[id]', params: { id: a.txnId } })}>
                  <Surface style={styles.alert}>
                    <IconBubble
                      name={a.status === 'CLEARED' ? 'shield-checkmark' : 'warning'}
                      tint={t.fg}
                      bg={t.bg}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.head}>
                        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                          {ruleTitle(a.ruleId)}
                        </Text>
                        <Text style={[styles.when, { color: c.muted }]}>{relative(a.ts)}</Text>
                      </View>
                      <Text style={[styles.detail, { color: c.muted }]}>
                        <Text style={{ color: c.text, fontWeight: '600' }}>{money(a.amount)}</Text> at {a.merchant}.{' '}
                        {RULE_TEXT[a.ruleId]?.detail}
                      </Text>
                      <View style={styles.foot}>
                        <Pill label={t.label} fg={t.fg} bg={t.bg} />
                        <Ionicons name="chevron-forward" size={18} color={c.muted} />
                      </View>
                    </View>
                  </Surface>
              </ScalePressable>
              </FadeInUp>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginBottom: space.lg },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segmentText: { fontSize: 14, fontWeight: '700' },
  alert: { flexDirection: 'row', gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  when: { fontSize: 12 },
  detail: { fontSize: 14, lineHeight: 20 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
});
