import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';

import { AuthProvider, useAuth } from '@/data/auth';
import { SettingsProvider } from '@/data/settings';
import { StoreProvider } from '@/data/store';
import { useColors, useScheme } from '@/theme';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <UserScope />
      </AuthProvider>
    </SettingsProvider>
  );
}

function UserScope() {
  const { user, restoring } = useAuth();
  if (restoring) return null;
  if (!user) return <AppShell signedIn={false} />;
  return (
    <StoreProvider key={user.cardId}>
      <AppShell signedIn />
    </StoreProvider>
  );
}

function AppShell({ signedIn }: { signedIn: boolean }) {
  const c = useColors();
  const scheme = useScheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: c.surfaceAlt }}>
        <View
          style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center' } : { flex: 1 }}
        >
          <Stack
            screenOptions={{
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: c.bg },
              headerShadowVisible: false,
              headerTintColor: c.text,
              headerTitleStyle: { color: c.text, fontWeight: '700' },
              contentStyle: { backgroundColor: c.bg },
            }}
          >
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="txn/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
              <Stack.Screen
                name="card/freeze"
                options={{ title: '', headerBackTitle: 'Back', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="pay"
                options={{ title: 'Pay', headerBackTitle: 'Back', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="transfer/index"
                options={{ title: 'Transfer', headerBackTitle: 'Back', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="transfer/confirm" options={{ title: 'Confirm transfer', headerBackTitle: 'Back' }} />
              <Stack.Screen
                name="transfer/done"
                options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
              />
            </Stack.Protected>
          </Stack>
        </View>
      </View>
    </>
  );
}
