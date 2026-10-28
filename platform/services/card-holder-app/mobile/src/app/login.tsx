import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BANK_NAME } from '@/components/brand';
import { Logo } from '@/components/Logo';
import { FadeInUp } from '@/components/motion';
import { Button, Surface } from '@/components/ui';
import { CARD_ID, LoginError, useAuth } from '@/data/auth';
import { radius, space, useColors } from '@/theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [cardId, setCardId] = useState(process.env.EXPO_PUBLIC_CARD_ID ?? '');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = CARD_ID.test(cardId) && password.length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(cardId, password);
    } catch (e) {
      setError(e instanceof LoginError ? e.message : `Could not sign in: ${message(e)}`);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl * 2 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp style={styles.brand}>
          <Logo size={80} />
          <Text style={[styles.title, { color: c.text }]}>{BANK_NAME}</Text>
          <Text style={[styles.subtitle, { color: c.muted }]}>Welcome back. Sign in with your card number.</Text>
        </FadeInUp>

        <FadeInUp delay={80}>
          <Surface style={styles.form}>
            <Text style={[styles.label, { color: c.muted }]}>Card number</Text>
            <TextInput
              value={cardId}
              onChangeText={(t) => setCardId(t.replace(/\D/g, '').slice(0, 19))}
              placeholder="8 to 19 digits"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              autoComplete="off"
              accessibilityLabel="Card number"
              style={[styles.input, { color: c.text, backgroundColor: c.surfaceAlt }]}
            />

            <Text style={[styles.label, styles.gap, { color: c.muted }]}>Password</Text>
            <View style={[styles.passwordRow, { backgroundColor: c.surfaceAlt }]}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={c.muted}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                accessibilityLabel="Password"
                style={[styles.input, styles.passwordInput, { color: c.text }]}
              />
              <Pressable
                onPress={() => setReveal((r) => !r)}
                hitSlop={12}
                accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
              </Pressable>
            </View>

            {error && (
              <View style={[styles.error, { backgroundColor: c.declineBg }]}>
                <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
                <Text style={[styles.errorText, { color: c.decline }]}>{error}</Text>
              </View>
            )}

            <View style={styles.gap}>
              <Button
                label={busy ? 'Signing in…' : 'Log in'}
                icon="log-in-outline"
                onPress={submit}
                disabled={!valid || busy}
              />
            </View>
          </Surface>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  brand: { alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: space.sm },
  subtitle: { fontSize: 15 },
  form: { gap: space.sm },
  label: { fontSize: 13, fontWeight: '600' },
  gap: { marginTop: space.md },
  input: { fontSize: 16, paddingHorizontal: space.md, paddingVertical: 14, borderRadius: radius.md },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingRight: space.md },
  passwordInput: { flex: 1 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.sm,
  },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
