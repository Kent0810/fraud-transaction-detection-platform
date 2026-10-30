import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Verdict } from '@/data/types';
import { radius, space, useColors } from '@/theme';

export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.surface, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: c.muted }]}>{title}</Text>
      {action}
    </View>
  );
}

export function ScreenTitle({ title }: { title: string }) {
  const c = useColors();
  return <Text style={[styles.screenTitle, { color: c.text }]}>{title}</Text>;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  ALLOW: 'Approved',
  STEP_UP: 'Needs verification',
  DECLINE: 'Declined',
};

export function useVerdictTone() {
  const c = useColors();
  return {
    ALLOW: { fg: c.allow, bg: c.allowBg },
    STEP_UP: { fg: c.stepUp, bg: c.stepUpBg },
    DECLINE: { fg: c.decline, bg: c.declineBg },
  };
}

export function StatusPill({ decision, compact }: { decision: Verdict; compact?: boolean }) {
  const tone = useVerdictTone()[decision];
  return (
    <Pill label={compact && decision === 'STEP_UP' ? 'Verify' : VERDICT_LABEL[decision]} fg={tone.fg} bg={tone.bg} />
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
  const fill = pct >= 1 ? c.decline : pct >= 0.8 ? c.stepUp : c.text;
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const c = useColors();
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    danger: { bg: c.surface, fg: c.decline, border: c.border },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptyDetail, { color: c.muted }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  screenTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, paddingTop: space.sm, paddingBottom: space.lg },
  pill: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  button: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  empty: { paddingVertical: space.xxl, gap: space.xs },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyDetail: { fontSize: 15, lineHeight: 21 },
});
