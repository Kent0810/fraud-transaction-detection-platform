import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { space, useColors } from '@/theme';

import { BANK_NAME, BRAND_FROM, BRAND_TO, MONOGRAM } from './brand';

export function Logo({ size = 40, mono }: { size?: number; mono?: boolean }) {
  const gradient = `brand-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`${BANK_NAME} logo`}>
      {!mono && (
        <>
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={BRAND_FROM} />
              <Stop offset="1" stopColor={BRAND_TO} />
            </LinearGradient>
          </Defs>
          <Rect width={100} height={100} rx={26} fill={`url(#${gradient})`} />
        </>
      )}
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
  name: { fontWeight: '800', letterSpacing: -0.3 },
});
