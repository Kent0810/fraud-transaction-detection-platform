import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { money, PERIOD_LABEL } from '@/components/format';
import { FadeInUp } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Ring, ScreenTitle, SectionHeader, Surface } from '@/components/ui';
import { groupThousands, parseVnd } from '@/components/vnd';
import { useStore } from '@/data/store';
import type { Period } from '@/data/types';
import { radius, space, useColors } from '@/theme';

const PERIODS: Period[] = ['DAY', 'WEEK', 'MONTH'];
const PERIOD_ADJECTIVE: Record<Period, string> = { DAY: 'Daily', WEEK: 'Weekly', MONTH: 'Monthly' };
const PRESETS = [10_000_000, 25_000_000, 40_000_000, 60_000_000];

export default function BudgetScreen() {
  const c = useColors();
  const { budget, setBudget } = useStore();
  const [limitText, setLimitText] = useState(groupThousands(budget.limit));
  const [period, setPeriod] = useState<Period>(budget.period);
  const [saved, setSaved] = useState(false);

  const limit = parseVnd(limitText);
  const valid = limit > 0;
  const changed = valid && (limit !== budget.limit || period !== budget.period);
  const left = budget.limit - budget.spent;
  const pct = budget.spent / budget.limit;

  const edit = (fn: () => void) => {
    fn();
    setSaved(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <ScreenTitle title="Budget" subtitle="Spending" />

        <FadeInUp>
          <Surface style={styles.overview}>
            <Ring value={pct}>
              <Text style={[styles.pct, { color: c.text }]}>{Math.round(pct * 100)}%</Text>
              <Text style={[styles.pctLabel, { color: c.muted }]}>used</Text>
            </Ring>
            <View style={styles.stats}>
              <Stat label="Spent" value={money(budget.spent)} />
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <Stat
                label={left >= 0 ? 'Left' : 'Over'}
                value={money(Math.abs(left))}
                color={left >= 0 ? c.allow : c.decline}
              />
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <Stat label={`Per ${PERIOD_LABEL[budget.period]}`} value={money(budget.limit)} />
            </View>
          </Surface>
        </FadeInUp>

        <FadeInUp delay={150}>
          <SectionHeader title="Set a new budget" />
          <Surface style={{ gap: space.lg }}>
            <View
              style={[
                styles.amountBox,
                { backgroundColor: c.surfaceAlt, borderColor: valid ? 'transparent' : c.decline },
              ]}
            >
              <TextInput
                value={limitText}
                onChangeText={(t) => {
                  const n = parseVnd(t);
                  edit(() => setLimitText(n ? groupThousands(Math.min(n, 999_999_999_999)) : ''));
                }}
                keyboardType="number-pad"
                accessibilityLabel="Budget limit in dong"
                style={[styles.amountInput, { color: c.text }]}
              />
              <Text style={[styles.currency, { color: c.muted }]}>VND</Text>
            </View>

            <View style={styles.presets}>
              {PRESETS.map((p) => {
                const on = limit === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => edit(() => setLimitText(groupThousands(p)))}
                    style={[styles.preset, { backgroundColor: on ? c.primarySoft : c.surfaceAlt }]}
                  >
                    <Text style={{ color: on ? c.primary : c.text, fontWeight: '700' }}>{p / 1_000_000}M đ</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
              {PERIODS.map((p) => {
                const on = p === period;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => edit(() => setPeriod(p))}
                    style={[styles.segmentItem, on && { backgroundColor: c.surface }]}
                  >
                    <Text style={{ color: on ? c.text : c.muted, fontWeight: '700' }}>{PERIOD_ADJECTIVE[p]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              label={saved ? 'Saved' : 'Save budget'}
              icon={saved ? 'checkmark' : undefined}
              onPress={() => {
                setBudget(limit, period);
                setSaved(true);
              }}
              disabled={!changed && !saved}
            />
            <Text style={[styles.note, { color: c.muted }]}>
              Going over budget sends you an alert. It never declines a payment.
            </Text>
          </Surface>
        </FadeInUp>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const c = useColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color ?? c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { alignItems: 'center', gap: space.xl, paddingVertical: space.xl },
  pct: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  pctLabel: { fontSize: 14, marginTop: -2 },
  stats: { flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statDivider: { width: StyleSheet.hairlineWidth },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
  },
  currency: { fontSize: 16, fontWeight: '700' },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 32,
    fontWeight: '800',
    paddingVertical: space.md,
    marginRight: space.sm,
  },
  presets: { flexDirection: 'row', gap: space.sm },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  note: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
