import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { category, day, money, time } from '@/components/format';
import { Button, Empty, SectionHeader, StatusPill, Surface, useVerdictTone } from '@/components/ui';
import { RULE_TEXT } from '@/data/rules';
import { useStore } from '@/data/store';
import { space, useColors } from '@/theme';

export default function TxnScreen() {
  const c = useColors();
  const tones = useVerdictTone();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, ruleFor, setMerchantRule, releaseMerchant } = useStore();
  const txn = transactions.find((t) => t.txnId === id);

  if (!txn) {
    return <Empty title="Transaction not found" detail="History goes back 90 days." />;
  }

  const tone = tones[txn.decision];
  const flagged = txn.decision !== 'ALLOW';
  const transfer = txn.channel === 'TRANSFER';
  const rule = ruleFor(txn.merchant);

  const details: [string, string][] = [
    ['Date', `${day(txn.ts)}, ${time(txn.ts)}`],
    ...(transfer
      ? [['To account', (txn.counterpartyAccount ?? '').replace(':', ' · ')] as [string, string]]
      : [['Category', category(txn.category)] as [string, string]]),
    ['Reference', txn.txnId],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={[styles.merchant, { color: c.text }]}>{txn.merchant}</Text>
        <Text
          style={[
            styles.amount,
            {
              color: txn.decision === 'DECLINE' ? c.muted : c.text,
              textDecorationLine: txn.decision === 'DECLINE' ? 'line-through' : 'none',
            },
          ]}
        >
          -{money(txn.amount)}
        </Text>
        <StatusPill decision={txn.decision} />
      </View>

      {flagged && (
        <Surface style={[styles.why, { backgroundColor: tone.bg, borderColor: tone.bg }]}>
          <Text style={[styles.whyTitle, { color: tone.fg }]}>
            {transfer ? 'Why this transfer was declined' : 'Why we flagged this'}
          </Text>
          {txn.firedRules.map((r) => (
            <View key={r} style={styles.reason}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reasonTitle, { color: c.text }]}>{RULE_TEXT[r]?.title ?? r}</Text>
                <Text style={[styles.reasonDetail, { color: c.muted }]}>{RULE_TEXT[r]?.detail}</Text>
              </View>
            </View>
          ))}
          {!transfer && <Text style={[styles.score, { color: c.muted }]}>Risk score {txn.score.toFixed(1)} / 1.0</Text>}
        </Surface>
      )}

      <SectionHeader title="Details" />
      <Surface style={styles.list}>
        {details.map(([k, v], i) => (
          <View
            key={k}
            style={[styles.detailRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
          >
            <Text style={[styles.detailKey, { color: c.muted }]}>{k}</Text>
            <Text style={[styles.detailValue, { color: c.text }]} numberOfLines={1}>
              {v}
            </Text>
          </View>
        ))}
      </Surface>

      {!transfer && (
        <>
          <SectionHeader title="This merchant" />
          {rule ? (
            <Surface style={{ gap: space.lg }}>
              <View style={styles.ruleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonTitle, { color: c.text }]}>
                    {rule.type === 'BLOCK' ? 'Blocked' : 'Trusted'}
                  </Text>
                  <Text style={[styles.reasonDetail, { color: rule.pending ? c.stepUp : c.muted }]}>
                    {rule.pending
                      ? 'Taking effect…'
                      : rule.type === 'BLOCK'
                        ? 'Future payments here will be declined.'
                        : 'Fraud checks are skipped for this merchant.'}
                  </Text>
                </View>
              </View>
              <Button label="Remove rule" variant="secondary" onPress={() => releaseMerchant(txn.merchant)} />
            </Surface>
          ) : (
            <View style={{ gap: space.sm }}>
              <Button
                label="Block this merchant"
                variant="danger"
                onPress={() => setMerchantRule(txn.merchant, 'BLOCK')}
              />
              <Button
                label="Trust this merchant"
                variant="secondary"
                onPress={() => setMerchantRule(txn.merchant, 'ALLOW')}
              />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { gap: space.xs, paddingTop: space.sm, paddingBottom: space.lg },
  merchant: { fontSize: 17, fontWeight: '500' },
  amount: { fontSize: 36, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginBottom: 4 },
  why: { gap: space.md },
  whyTitle: { fontSize: 15, fontWeight: '600' },
  reason: { flexDirection: 'row', gap: space.md },
  reasonTitle: { fontSize: 15, fontWeight: '600' },
  reasonDetail: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  score: { fontSize: 13, fontWeight: '600' },
  list: { paddingVertical: space.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md, gap: space.lg },
  detailKey: { fontSize: 15 },
  detailValue: { fontSize: 15, flexShrink: 1, textAlign: 'right' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
