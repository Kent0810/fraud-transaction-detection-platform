import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';

import { SettingsProvider, useSettings } from '@/data/settings';
import { StoreProvider } from '@/data/store';
import { useColors, useScheme } from '@/theme';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <UserScope />
    </SettingsProvider>
  );
}

// key = user id: switching accounts remounts the store, so every screen starts fresh with that
// user's card data (and the app returns to Home, like a real account switch).
function UserScope() {
  const { userId } = useSettings();
  return (
    <StoreProvider key={userId}>
      <AppShell />
    </StoreProvider>
  );
}

// Separate component so it can read the theme from SettingsProvider above it.
function AppShell() {
  const c = useColors();
  const scheme = useScheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* On web, keep a phone-width column instead of stretching across the screen. */}
      <View style={{ flex: 1, backgroundColor: c.surfaceAlt }}>
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center' } : { flex: 1 }}>
          <Stack
            screenOptions={{
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: c.bg },
              headerShadowVisible: false,
              headerTintColor: c.text,
              headerTitleStyle: { color: c.text, fontWeight: '700' },
              contentStyle: { backgroundColor: c.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="txn/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="transfer/index"
              options={{ title: 'Transfer', headerBackTitle: 'Back', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="transfer/confirm" options={{ title: 'Confirm transfer', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="transfer/done"
              options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
            />
          </Stack>
        </View>
      </View>
    </>
  );
}
