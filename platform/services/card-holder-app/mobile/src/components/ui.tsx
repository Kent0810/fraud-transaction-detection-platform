import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Verdict } from '@/data/types';
import { radius, shadow, space, useColors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.surface, { backgroundColor: c.surface }, shadow(c), style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useColors();
  return (
    <View style={styles.screenTitle}>
      {subtitle && <Text style={[styles.screenSubtitle, { color: c.muted }]}>{subtitle}</Text>}
      <Text style={[styles.screenTitleText, { color: c.text }]}>{title}</Text>
    </View>
  );
}

export function IconBubble({ name, tint, bg, size = 44 }: { name: IconName; tint: string; bg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.46} color={tint} />
    </View>
  );
}

const VERDICT_LABEL: Record<Verdict, string> = { ALLOW: 'Approved', STEP_UP: 'Needs verification', DECLINE: 'Declined' };

export function useVerdictTone() {
  const c = useColors();
  return {
    ALLOW: { fg: c.allow, bg: c.allowBg, icon: 'checkmark-circle' as IconName },
    STEP_UP: { fg: c.stepUp, bg: c.stepUpBg, icon: 'shield-half' as IconName },
    DECLINE: { fg: c.decline, bg: c.declineBg, icon: 'close-circle' as IconName },
  };
}

export function StatusPill({ decision, compact }: { decision: Verdict; compact?: boolean }) {
  const tone = useVerdictTone()[decision];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Ionicons name={tone.icon} size={12} color={tone.fg} />
      <Text style={[styles.pillText, { color: tone.fg }]}>
        {compact && decision === 'STEP_UP' ? 'Verify' : VERDICT_LABEL[decision]}
      </Text>
    </View>
  );
}

export function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  const fill = pct >= 1 ? c.decline : pct >= 0.8 ? c.stepUp : c.primary;
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Draws itself from empty to `value` on mount, and animates when the value changes.
export function Ring({ value, size = 180, stroke = 16, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color = pct >= 1 ? c.decline : pct >= 0.8 ? c.stepUp : c.primary;
  const progress = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    // strokeDashoffset is an SVG prop, so this can't use the native driver.
    Animated.timing(progress, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, progress]);
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled }: ButtonProps) {
  const c = useColors();
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary },
    secondary: { bg: c.surfaceAlt, fg: c.text },
    danger: { bg: c.declineBg, fg: c.decline },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      {icon && <Ionicons name={icon} size={18} color={look.fg} />}
      <Text style={[styles.buttonText, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <IconBubble name={icon} tint={c.primary} bg={c.primarySoft} size={64} />
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptyDetail, { color: c.muted }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radius.lg, padding: space.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  screenTitle: { paddingTop: space.sm, paddingBottom: space.lg },
  screenSubtitle: { fontSize: 15, marginBottom: 2 },
  screenTitleText: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  button: { flexDirection: 'row', gap: space.sm, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: space.xxl * 2, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: space.sm },
  emptyDetail: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
