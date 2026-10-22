import { Pressable, StyleSheet, Text, View } from 'react-native';

import { relative } from '@/components/format';
import { FadeInUp, stagger } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Empty, IconBubble, ScreenTitle, SectionHeader, Surface } from '@/components/ui';
import { useStore } from '@/data/store';
import type { MerchantRule, RuleType } from '@/data/types';
import { space, useColors } from '@/theme';

// Merchant rules: blocked merchants are always declined, trusted ones skip the fraud checks.
export default function MerchantsScreen() {
  const { rules } = useStore();

  return (
    <Screen>
      <ScreenTitle title="Merchants" subtitle="Controls" />
      {rules.length === 0 ? (
        <Empty
          icon="storefront"
          title="No merchant rules"
          detail="Open any transaction to block a merchant or mark it as trusted."
        />
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
            <FadeInUp key={r.merchant} delay={stagger(i, 60)}>
            <View style={[styles.rule, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <IconBubble
                name={blocked ? 'ban' : 'checkmark-done'}
                tint={blocked ? c.decline : c.allow}
                bg={blocked ? c.declineBg : c.allowBg}
              />
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
                style={({ pressed }) => [styles.release, { backgroundColor: c.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.releaseText, { color: c.text }]}>Remove</Text>
              </Pressable>
            </View>
            </FadeInUp>
          ))
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  merchant: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 3 },
  release: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  releaseText: { fontSize: 13, fontWeight: '700' },
  none: { fontSize: 14, paddingVertical: space.md },
});
