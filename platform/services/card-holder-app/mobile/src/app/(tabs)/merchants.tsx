import { Pressable, StyleSheet, Text, View } from 'react-native';

import { relative } from '@/components/format';
import { Screen } from '@/components/Screen';
import { Empty, ScreenTitle, SectionHeader, Surface } from '@/components/ui';
import { useStore } from '@/data/store';
import type { MerchantRule, RuleType } from '@/data/types';
import { radius, space, useColors } from '@/theme';

export default function MerchantsScreen() {
  const { rules } = useStore();

  return (
    <Screen>
      <ScreenTitle title="Merchants" />
      {rules.length === 0 ? (
        <Empty title="No merchant rules" detail="Open any transaction to block a merchant or mark it as trusted." />
      ) : (
        <>
          <RuleSection title="Blocked" type="BLOCK" rules={rules.filter((r) => r.type === 'BLOCK')} />
          <RuleSection title="Trusted" type="ALLOW" rules={rules.filter((r) => r.type === 'ALLOW')} />
        </>
      )}
    </Screen>
  );
}

function RuleSection({ title, type, rules }: { title: string; type: RuleType; rules: MerchantRule[] }) {
  const c = useColors();
  const { releaseMerchant } = useStore();
  const blocked = type === 'BLOCK';
  return (
    <View>
      <SectionHeader title={title} />
      <Surface style={styles.list}>
        {rules.length === 0 ? (
          <Text style={[styles.none, { color: c.muted }]}>
            {blocked ? 'No blocked merchants.' : 'No trusted merchants.'}
          </Text>
        ) : (
          rules.map((r, i) => (
            <View
              key={r.merchant}
              style={[styles.rule, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.merchant, { color: c.text }]} numberOfLines={1}>
                  {r.merchant}
                </Text>
                <Text style={[styles.meta, { color: r.pending ? c.stepUp : c.muted }]}>
                  {r.pending ? 'Taking effect…' : `Added ${relative(r.createdAt).toLowerCase()}`}
                </Text>
              </View>
              <Pressable
                onPress={() => releaseMerchant(r.merchant)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.release, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.releaseText, { color: c.text }]}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  merchant: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, marginTop: 2 },
  release: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1 },
  releaseText: { fontSize: 13, fontWeight: '600' },
  none: { fontSize: 14, paddingVertical: space.md },
});
