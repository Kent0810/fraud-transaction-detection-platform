import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ruleTitle } from '@/data/rules';
import { useStore } from '@/data/store';
import type { CardNotice } from '@/data/types';
import { radius, shadow, space, useColors, type Colors } from '@/theme';

import { FadeInUp } from './motion';
import { money } from './format';

const SHOW_MS = 5_000;

type IconName = keyof typeof Ionicons.glyphMap;

function look(n: CardNotice, c: Colors): { icon: IconName; tint: string; bg: string; title: string; detail: string } {
  const what = n.channel === 'TRANSFER' ? 'Transfer' : 'Payment';
  switch (n.kind) {
    case 'RECEIVED':
      return {
        icon: 'arrow-down',
        tint: c.allow,
        bg: c.allowBg,
        title: `+${money(n.amount)} received`,
        detail: `From ${n.counterparty}`,
      };
    case 'DECLINED':
      return {
        icon: 'close',
        tint: c.decline,
        bg: c.declineBg,
        title: `${what} declined · ${money(n.amount)}`,
        detail: `${n.counterparty} · ${n.reasons.map(ruleTitle).join(', ')}`,
      };
    case 'ALERT':
      return {
        icon: 'shield-half',
        tint: c.stepUp,
        bg: c.stepUpBg,
        title: `Check this ${what.toLowerCase()} · ${money(n.amount)}`,
        detail: `${n.counterparty} · ${n.reasons.map(ruleTitle).join(', ')}`,
      };
    default:
      return {
        icon: 'checkmark',
        tint: c.allow,
        bg: c.allowBg,
        title: `${what} sent · ${money(n.amount)}`,
        detail: `To ${n.counterparty}`,
      };
  }
}

export function NoticeBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { notice, dismissNotice } = useStore();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  const l = look(notice, c);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <FadeInUp key={`${notice.txnId}-${notice.kind}`} distance={-16}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            dismissNotice();
            router.push({ pathname: '/txn/[id]', params: { id: notice.txnId } });
          }}
          style={[styles.banner, { backgroundColor: c.surface }, shadow(c)]}
        >
          <View style={[styles.icon, { backgroundColor: l.bg }]}>
            <Ionicons name={l.icon} size={18} color={l.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {l.title}
            </Text>
            <Text style={[styles.detail, { color: c.muted }]} numberOfLines={1}>
              {l.detail}
            </Text>
          </View>
          <Pressable onPress={dismissNotice} hitSlop={10} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={18} color={c.muted} />
          </Pressable>
        </Pressable>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 13, marginTop: 2 },
});
