import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const c = useColors();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }]}>
      <Text style={[styles.text, { color: c.text, fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '600' },
});
