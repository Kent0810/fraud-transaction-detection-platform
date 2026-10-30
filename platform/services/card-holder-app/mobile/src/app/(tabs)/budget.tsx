import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { money, PERIOD_LABEL } from '@/components/format';
import { Screen } from '@/components/Screen';
import { Button, ProgressBar, ScreenTitle, SectionHeader, Surface } from '@/components/ui';
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
        <ScreenTitle title="Budget" />

        <Surface style={styles.overview}>
          <Text style={[styles.label, { color: c.muted }]}>Spent this {PERIOD_LABEL[budget.period]}</Text>
          <Text style={[styles.spent, { color: c.text }]}>{money(budget.spent)}</Text>
          <ProgressBar value={pct} />
          <View style={styles.stats}>
            <Text style={[styles.stat, { color: c.muted }]}>
              {Math.round(pct * 100)}% of {money(budget.limit)}
            </Text>
            <Text style={[styles.stat, { color: left >= 0 ? c.muted : c.decline }]}>
              {money(Math.abs(left))} {left >= 0 ? 'left' : 'over'}
            </Text>
          </View>
        </Surface>

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
                  style={[styles.preset, { borderColor: on ? c.text : c.border }]}
                >
                  <Text style={{ color: c.text, fontWeight: on ? '600' : '400' }}>{p / 1_000_000}M đ</Text>
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
                  <Text style={{ color: on ? c.text : c.muted, fontWeight: '600' }}>{PERIOD_ADJECTIVE[p]}</Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label={saved ? 'Saved' : 'Save budget'}
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
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overview: { gap: space.sm },
  label: { fontSize: 14 },
  spent: { fontSize: 30, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'], marginBottom: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontSize: 13, fontVariant: ['tabular-nums'] },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
  },
  currency: { fontSize: 15, fontWeight: '600' },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 28,
    fontWeight: '600',
    paddingVertical: space.md,
    marginRight: space.sm,
  },
  presets: { flexDirection: 'row', gap: space.sm },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 1 },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md - 2 },
  note: { fontSize: 13, lineHeight: 18 },
});
