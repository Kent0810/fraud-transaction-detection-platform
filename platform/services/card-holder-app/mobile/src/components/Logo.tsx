import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { space, useColors } from '@/theme';

import { BANK_NAME, BRAND, MONOGRAM } from './brand';

export function Logo({ size = 40, mono }: { size?: number; mono?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`${BANK_NAME} logo`}>
      {!mono && <Rect width={100} height={100} rx={18} fill={BRAND} />}
      <Path
        d={MONOGRAM.path}
        stroke="#fff"
        strokeWidth={MONOGRAM.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Logo size={size} />
      <Text style={[styles.name, { color: c.text, fontSize: size * 0.6 }]}>{BANK_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontWeight: '600' },
});
