import { StyleSheet, Text, View } from 'react-native';

import type { Period } from '@/data/types';
import { radius, space, useColors } from '@/theme';

import { BANK_SHORT } from './brand';
import { money, PERIOD_LABEL } from './format';
import { Logo } from './Logo';

type Props = {
  last4: string;
  spent: number;
  limit: number;
  period: Period;
  frozen: boolean;
};

export function BankCard({ last4, spent, limit, period, frozen }: Props) {
  const c = useColors();
  const pct = Math.min(1, spent / limit);
  return (
    <View style={[styles.card, { backgroundColor: frozen ? '#4A4A47' : c.card }]}>
      <View style={styles.top}>
        <View style={styles.brandRow}>
          <Logo size={20} mono />
          <Text style={styles.brand}>{BANK_SHORT} Debit</Text>
        </View>
        {frozen && <Text style={styles.tag}>Frozen</Text>}
      </View>
      <Text style={styles.label}>Spent this {PERIOD_LABEL[period]}</Text>
      <Text style={styles.amount}>{money(spent)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.number}>•••• {last4}</Text>
        <Text style={styles.small}>of {money(limit)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tag: { color: '#fff', fontSize: 13, fontWeight: '600' },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  amount: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: space.lg,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  number: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', letterSpacing: 1 },
  small: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
