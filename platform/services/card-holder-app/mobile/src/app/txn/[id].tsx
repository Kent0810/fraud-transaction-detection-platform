import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { category, categoryIcon, day, money, time } from '@/components/format';
import { Empty, IconBubble, SectionHeader, StatusPill, Surface, useVerdictTone } from '@/components/ui';
import { fetchTransaction } from '@/data/queries';
import { RULE_TEXT } from '@/data/rules';
import { useStore } from '@/data/store';
import type { Txn } from '@/data/types';
import { space, useColors } from '@/theme';

export default function TxnScreen() {
  const c = useColors();
  const tones = useVerdictTone();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions } = useStore();
  const listed = transactions.find((t) => t.txnId === id);
  const inList = listed !== undefined;
  // The store holds only the latest 100: an older one, e.g. opened from an alert, is fetched on its own.
  const [fetched, setFetched] = useState<Txn | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (inList || !id) {
      return;
    }
    let live = true;
    fetchTransaction(id).then(
      (t) => {
        if (live) {
          setFetched(t);
        }
      },
      () => {
        if (live) {
          setMissing(true);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [id, inList]);

  const txn = listed ?? fetched;
  if (!txn) {
    if (!missing) {
      return <ActivityIndicator color={c.primary} style={{ marginTop: space.xxl }} />;
    }
    return <Empty icon="search" title="Transaction not found" detail="History goes back 90 days." />;
  }

  const transfer = txn.channel === 'TRANSFER';
  // Received from another card of this bank: merchant and recipientAccount are the sender's.
  const received = txn.direction === 'IN';
  // Approved by the fraud check but refused by the ledger, e.g. not enough balance.
  const refused = txn.status === 'DECLINED';
  const declined = txn.decision === 'DECLINE' || refused;
  const verdict = refused ? 'DECLINE' : txn.decision;
  const tone = tones[verdict];
  const flagged = verdict !== 'ALLOW';
  const reasons = refused ? txn.declinedFor : txn.firedRules;

  const details: [string, string][] = [
    ['Date', `${day(txn.ts)}, ${time(txn.ts)}`],
    ...(transfer
      ? [
          [received ? 'From account' : 'To account', (txn.recipientAccount ?? '').replace(':', ' · ')] as [
            string,
            string,
          ],
        ]
      : [['Category', category(txn.category)] as [string, string]]),
    ['Reference', txn.txnId],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <IconBubble
          name={received ? 'arrow-down' : categoryIcon(txn.category)}
          tint={flagged ? tone.fg : received ? c.allow : c.primary}
          bg={flagged ? tone.bg : received ? c.allowBg : c.primarySoft}
          size={72}
        />
        <Text style={[styles.merchant, { color: c.text }]}>{txn.merchant}</Text>
        <Text
          style={[
            styles.amount,
            {
              color: declined ? c.muted : received ? c.allow : c.text,
              textDecorationLine: declined ? 'line-through' : 'none',
            },
          ]}
        >
          {received ? '+' : '-'}
          {money(txn.amount)}
        </Text>
        <View>
          <StatusPill decision={verdict} />
        </View>
      </View>

      {flagged && (
        <Surface style={[styles.why, { backgroundColor: tone.bg }]}>
          <View style={styles.whyHead}>
            <Ionicons name="shield-half" size={18} color={tone.fg} />
            <Text style={[styles.whyTitle, { color: tone.fg }]}>
              {transfer
                ? 'Why this transfer was declined'
                : refused
                  ? 'Why this payment was declined'
                  : 'Why we flagged this'}
            </Text>
          </View>
          {reasons.map((r) => (
            <View key={r} style={styles.reason}>
              <View style={[styles.bullet, { backgroundColor: tone.fg }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.reasonTitle, { color: c.text }]}>{RULE_TEXT[r]?.title ?? r}</Text>
                <Text style={[styles.reasonDetail, { color: c.muted }]}>{RULE_TEXT[r]?.detail}</Text>
              </View>
            </View>
          ))}
          {!transfer && !refused && (
            <Text style={[styles.score, { color: c.muted }]}>Risk score {txn.score.toFixed(1)} / 1.0</Text>
          )}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.xl },
  merchant: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: space.sm },
  amount: { fontSize: 44, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  why: { gap: space.md },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  whyTitle: { fontSize: 15, fontWeight: '800' },
  reason: { flexDirection: 'row', gap: space.md },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  reasonTitle: { fontSize: 15, fontWeight: '700' },
  reasonDetail: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  score: { fontSize: 13, fontWeight: '600' },
  list: { paddingVertical: space.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md, gap: space.lg },
  detailKey: { fontSize: 15 },
  detailValue: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
