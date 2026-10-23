import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme';

export function Screen({ children, ...rest }: { children: ReactNode } & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...rest}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }, rest.contentContainerStyle]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
});
