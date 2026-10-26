import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { accountNumber as printAccount } from '@/components/format';
import { FadeInUp } from '@/components/motion';
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
    return <Empty icon="swap-horizontal" title="No transfer to confirm" detail="Go back and start a new transfer." />;
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <FadeInUp style={styles.hero}>
        <Text style={[styles.heroLabel, { color: c.muted }]}>Amount</Text>
        <Text style={[styles.amount, { color: c.primary }]}>{vnd(draft.amount)}</Text>
        <Text style={[styles.words, { color: c.muted }]}>{vndInWords(draft.amount)}</Text>
      </FadeInUp>

      <FadeInUp delay={80}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {rows.map(([k, v], i) => (
            <View key={k} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
              <Text style={[styles.val, { color: k === 'Fee' ? c.allow : c.text }]}>{v}</Text>
            </View>
          ))}
        </View>
      </FadeInUp>

      <FadeInUp delay={160}>
        <View style={styles.authHead}>
          <Ionicons name="shield-checkmark" size={18} color={c.primary} />
          <Text style={[styles.authTitle, { color: c.text }]}>Enter your password to confirm</Text>
        </View>
        <View style={[styles.passwordRow, { backgroundColor: c.surface }]}>
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
          <Pressable onPress={() => setReveal((r) => !r)} hitSlop={12} accessibilityLabel={reveal ? 'Hide password' : 'Show password'}>
            <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>
        {error ? (
          <View style={[styles.error, { backgroundColor: c.declineBg }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
            <Text style={[styles.errorText, { color: c.decline }]}>{error}</Text>
          </View>
        ) : (
          <Text style={[styles.authHint, { color: c.muted }]}>Asked on every transfer, even when you are signed in.</Text>
        )}
      </FadeInUp>

      <View style={{ marginTop: space.xl }}>
        {sending ? (
          <View style={[styles.sending, { backgroundColor: c.primary }]}>
            <ActivityIndicator color={c.onPrimary} />
            <Text style={{ color: c.onPrimary, fontWeight: '700', fontSize: 16 }}>Processing…</Text>
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
  hero: { alignItems: 'center', gap: 4, paddingVertical: space.lg },
  heroLabel: { fontSize: 14 },
  amount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  words: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  card: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  authHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  authTitle: { fontSize: 16, fontWeight: '800' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingRight: space.md },
  passwordInput: { flex: 1, fontSize: 16, paddingHorizontal: space.md, paddingVertical: 14 },
  authHint: { fontSize: 12, textAlign: 'center', marginTop: space.sm },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.sm },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  sending: { flexDirection: 'row', gap: space.sm, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
});
