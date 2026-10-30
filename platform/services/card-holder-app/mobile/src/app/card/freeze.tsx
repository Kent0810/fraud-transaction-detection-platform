import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { useUser } from '@/data/auth';
import { CardError, useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const FREEZE_EFFECTS = [
  'Card payments are declined, online and in store',
  'Transfers from this account are blocked',
  'You can still sign in and see your balance and history',
  'Unfreeze any time with your password',
];

// One screen both ways: freezing is a single tap, unfreezing asks for the password.
export default function FreezeCardScreen() {
  const c = useColors();
  const user = useUser();
  const { frozen, freezeCard, unfreezeCard } = useStore();
  // Fixed when the screen opens, so it doesn't switch to the other mode while the change goes through.
  const [unfreezing] = useState(frozen);
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last4 = user.cardId.slice(-4);

  const submit = async () => {
    if (busy || (unfreezing && !password)) return;
    setBusy(true);
    setError(null);
    try {
      await (unfreezing ? unfreezeCard(password) : freezeCard());
      router.back();
    } catch (e) {
      setError(e instanceof CardError ? e.message : message(e));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={[styles.title, { color: c.text }]}>
          {unfreezing ? `Unfreeze card •••• ${last4}` : `Freeze card •••• ${last4}?`}
        </Text>
        <Text style={[styles.detail, { color: c.muted }]}>
          {unfreezing
            ? 'Card payments and transfers will work again straight away.'
            : 'Lost your card, or think someone else has it? Freezing stops it straight away.'}
        </Text>
      </View>

      {unfreezing ? (
        <View>
          <Text style={[styles.authTitle, { color: c.text }]}>Enter your password to unfreeze</Text>
          <View style={[styles.passwordRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={c.muted}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
              accessibilityLabel="Password"
              style={[styles.passwordInput, { color: c.text }]}
            />
            <Pressable
              onPress={() => setReveal((r) => !r)}
              hitSlop={12}
              accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
            >
              <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: c.muted }]}>
            So someone holding your unlocked phone can&apos;t undo a freeze.
          </Text>
        </View>
      ) : (
        <View style={[styles.effects, { backgroundColor: c.surface, borderColor: c.border }]}>
          {FREEZE_EFFECTS.map((text, i) => (
            <View
              key={text}
              style={[styles.effect, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            >
              <Text style={[styles.effectText, { color: c.text }]}>{text}</Text>
            </View>
          ))}
        </View>
      )}

      {error && (
        <View style={[styles.error, { backgroundColor: c.declineBg }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
          <Text style={[styles.errorText, { color: c.decline }]}>{error}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {busy ? (
          <View style={[styles.busy, { backgroundColor: c.primary }]}>
            <ActivityIndicator color={c.onPrimary} />
            <Text style={{ color: c.onPrimary, fontWeight: '600', fontSize: 16 }}>
              {unfreezing ? 'Unfreezing…' : 'Freezing…'}
            </Text>
          </View>
        ) : (
          <Button
            label={unfreezing ? 'Unfreeze card' : 'Freeze card'}
            onPress={submit}
            disabled={unfreezing && !password}
          />
        )}
        {!busy && <Button label="Cancel" variant="secondary" onPress={() => router.back()} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.lg },
  title: { fontSize: 22, fontWeight: '700' },
  detail: { fontSize: 15, lineHeight: 21 },
  effects: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg },
  effect: { paddingVertical: space.md },
  effectText: { fontSize: 15 },
  authTitle: { fontSize: 15, fontWeight: '600', marginBottom: space.sm },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: space.md,
  },
  passwordInput: { flex: 1, fontSize: 16, paddingHorizontal: space.md, paddingVertical: 14 },
  hint: { fontSize: 13, marginTop: space.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  actions: { marginTop: space.xl, gap: space.md },
  busy: {
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
