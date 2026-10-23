import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Period } from '@/data/types';
import { radius, space, useColors } from '@/theme';

import { BANK_SHORT } from './brand';
import { money, PERIOD_LABEL } from './format';
import { Logo } from './Logo';
import { NATIVE } from './motion';

type Props = { last4: string; holder: string; spent: number; limit: number; period: Period; frozen: boolean };

export function BankCard({ last4, holder, spent, limit, period, frozen }: Props) {
  const c = useColors();
  const flip = useState(() => new Animated.Value(0))[0];
  const [back, setBack] = useState(false);
  const pct = Math.min(1, spent / limit);
  const colors: [string, string] = frozen ? ['#475569', '#1E293B'] : [c.cardFrom, c.cardTo];

  const toggle = () => {
    Animated.spring(flip, { toValue: back ? 0 : 1, friction: 8, tension: 60, useNativeDriver: NATIVE }).start();
    setBack(!back);
  };

  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const lift = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={back ? 'Show spending' : 'Show card details'}>
      <Animated.View style={{ transform: [{ scale: lift }] }}>
        <Animated.View style={[styles.face, { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] }]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Glows />
            <View style={styles.top}>
              <View style={styles.brandRow}>
                <Logo size={22} mono />
                <Text style={styles.brand}>{BANK_SHORT}</Text>
                <Text style={styles.debit}>Debit</Text>
              </View>
              {frozen ? (
                <View style={styles.tag}>
                  <Ionicons name="snow" size={12} color="#fff" />
                  <Text style={styles.tagText}>Frozen</Text>
                </View>
              ) : (
                <Ionicons name="wifi" size={20} color="rgba(255,255,255,0.8)" style={{ transform: [{ rotate: '90deg' }] }} />
              )}
            </View>
            <Text style={styles.label}>Spent this {PERIOD_LABEL[period]}</Text>
            <Text style={styles.amount}>{money(spent)}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%` }]} />
            </View>
            <View style={styles.bottom}>
              <Text style={styles.number}>••••  {last4}</Text>
              <Text style={styles.small}>of {money(limit)}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={[styles.face, styles.backFace, { transform: [{ perspective: 1000 }, { rotateY: backRotate }] }]}>
          <LinearGradient colors={colors} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
            <Glows />
            <View style={[styles.stripe]} />
            <Text style={styles.label}>Card number</Text>
            <Text style={styles.fullNumber}>••••  ••••  ••••  {last4}</Text>
            <View style={styles.backRow}>
              <View>
                <Text style={styles.small}>Holder</Text>
                <Text style={styles.backValue}>{holder}</Text>
              </View>
              <View>
                <Text style={styles.small}>Expires</Text>
                <Text style={styles.backValue}>09/29</Text>
              </View>
              <View>
                <Text style={styles.small}>CVV</Text>
                <Text style={styles.backValue}>•••</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function Glows() {
  return (
    <>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
    </>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
  backFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', minHeight: 200 },
  glowA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -90, right: -60 },
  glowB: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -70, left: -40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  debit: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  amount: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 2, marginBottom: space.lg, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#fff' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  number: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600', letterSpacing: 2 },
  small: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  stripe: { height: 36, marginHorizontal: -space.xl, backgroundColor: 'rgba(0,0,0,0.35)', marginBottom: space.lg },
  fullNumber: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 2, marginTop: 4, marginBottom: space.lg },
  backRow: { flexDirection: 'row', justifyContent: 'space-between' },
  backValue: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
});
