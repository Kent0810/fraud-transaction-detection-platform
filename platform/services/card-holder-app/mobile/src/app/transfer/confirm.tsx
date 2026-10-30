import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { accountNumber as printAccount } from '@/components/format';
import { Button, Empty } from '@/components/ui';
import { vnd, vndInWords } from '@/components/vnd';
import { newTransferId } from '@/data/commands';
import { TransferError, useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ConfirmTransferScreen() {
  const c = useColors();
  const { draft, banks, accountNumber, sendTransfer, setDraft } = useStore();
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id for this screen: pressing Confirm again after a timeout retries the same transfer, never a second one.
  const [transferId] = useState(newTransferId);

  if (!draft) {
    return <Empty title="No transfer to confirm" detail="Go back and start a new transfer." />;
  }

  const bank = banks.find((b) => b.code === draft.to.bankCode);
  const rows: [string, string][] = [
    ['From account', printAccount(accountNumber)],
    ['To account', draft.to.account],
    ['Account name', draft.to.name],
    ['Bank', bank ? `${bank.code} · ${bank.name}` : draft.to.bankCode],
    ['Method', draft.kind === 'NAPAS' ? 'NAPAS 247 instant transfer' : 'Internal transfer'],
    ['Message', draft.content],
    ['Fee', 'Free'],
  ];

  const confirm = async () => {
    if (!password || sending) return;
    setSending(true);
    setError(null);
    try {
      const transfer = await sendTransfer(draft, transferId, password);
      setDraft(null);
      router.replace({ pathname: '/transfer/done', params: { transferId: transfer.transferId } });
    } catch (e) {
      setError(e instanceof TransferError ? e.message : `Could not send: ${message(e)}`);
      setPassword('');
      setSending(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={[styles.heroLabel, { color: c.muted }]}>Amount</Text>
        <Text style={[styles.amount, { color: c.text }]}>{vnd(draft.amount)}</Text>
        <Text style={[styles.words, { color: c.muted }]}>{vndInWords(draft.amount)}</Text>
      </View>

      <View>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {rows.map(([k, v], i) => (
            <View
              key={k}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            >
              <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
              <Text style={[styles.val, { color: k === 'Fee' ? c.allow : c.text }]}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text style={[styles.authTitle, { color: c.text }]}>Enter your password to confirm</Text>
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
            onSubmitEditing={confirm}
            editable={!sending}
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
        {error ? (
          <View style={[styles.error, { backgroundColor: c.declineBg }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
            <Text style={[styles.errorText, { color: c.decline }]}>{error}</Text>
          </View>
        ) : (
          <Text style={[styles.authHint, { color: c.muted }]}>
            Asked on every transfer, even when you are signed in.
          </Text>
        )}
      </View>

      <View style={{ marginTop: space.xl }}>
        {sending ? (
          <View style={[styles.sending, { backgroundColor: c.primary }]}>
            <ActivityIndicator color={c.onPrimary} />
            <Text style={{ color: c.onPrimary, fontWeight: '600', fontSize: 16 }}>Checking…</Text>
          </View>
        ) : (
          <Button label="Confirm" onPress={confirm} disabled={!password} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { gap: 4, paddingTop: space.sm, paddingBottom: space.lg },
  heroLabel: { fontSize: 14 },
  amount: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  words: { fontSize: 13 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  authTitle: { fontSize: 15, fontWeight: '600', marginTop: space.xl, marginBottom: space.sm },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: space.md,
  },
  passwordInput: { flex: 1, fontSize: 16, paddingHorizontal: space.md, paddingVertical: 14 },
  authHint: { fontSize: 13, marginTop: space.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.sm,
  },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  sending: {
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
