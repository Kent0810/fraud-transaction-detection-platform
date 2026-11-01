import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const NATIVE = Platform.OS !== 'web';

export function FadeInUp({
  children,
  delay = 0,
  distance = 16,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  }, [t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export function PopIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const t = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(t, { toValue: 1, delay, friction: 5, tension: 120, useNativeDriver: NATIVE }).start();
  }, [t, delay]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return <Animated.View style={{ opacity: t, transform: [{ scale }] }}>{children}</Animated.View>;
}

export function ScalePressable({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: NATIVE }).start();
  return (
    <Pressable {...rest} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export const stagger = (i: number, step = 50, base = 0) => base + Math.min(i, 10) * step;
