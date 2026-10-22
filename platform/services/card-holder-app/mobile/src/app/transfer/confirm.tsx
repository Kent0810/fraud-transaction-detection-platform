import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type React from 'react';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeInUp } from '@/components/motion';
import { Button, Empty } from '@/components/ui';
import { vnd, vndInWords } from '@/components/vnd';
import { ACCOUNT } from '@/data/mock';
import { useStore } from '@/data/store';
import { radius, space, useColors } from '@/theme';

const OTP_LENGTH = 6;

// Review the transfer and enter a Smart OTP (any 6 digits in the demo).
export default function ConfirmTransferScreen() {
  const c = useColors();
  const { draft, banks, sendTransfer, setDraft } = useStore();
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const otpInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  if (!draft) {
    return <Empty icon="swap-horizontal" title="No transfer to confirm" detail="Go back and start a new transfer." />;
  }

  const bank = banks.find((b) => b.code === draft.to.bankCode);
  const rows: [string, string][] = [
    ['From account', ACCOUNT.number],
    ['To account', draft.to.account],
    ['Account name', draft.to.name],
    ['Bank', bank ? `${bank.code} · ${bank.name}` : draft.to.bankCode],
    ['Method', draft.kind === 'NAPAS' ? 'NAPAS 247 instant transfer' : 'Internal transfer'],
    ['Message', draft.content],
    ['Fee', 'Free'],
  ];

  const confirm = async () => {
    setSending(true);
    const transfer = await sendTransfer(draft);
    setDraft(null);
    router.replace({ pathname: '/transfer/done', params: { transferId: transfer.transferId } });
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
        <View style={styles.otpHead}>
          <Ionicons name="shield-checkmark" size={18} color={c.primary} />
          <Text style={[styles.otpTitle, { color: c.text }]}>Enter Smart OTP</Text>
        </View>
        <Pressable onPress={() => otpInput.current?.focus()} style={styles.otpBoxes} accessibilityLabel="OTP code">
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const filled = i < otp.length;
            const active = i === otp.length;
            return (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  { backgroundColor: c.surface, borderColor: active ? c.primary : filled ? c.border : 'transparent' },
                ]}>
                <Text style={[styles.otpDigit, { color: c.text }]}>{filled ? '•' : ''}</Text>
              </View>
            );
          })}
        </Pressable>
        {/* Hidden input behind the boxes: it holds the digits and brings up the keypad. */}
        <TextInput
          ref={otpInput}
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          autoFocus
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          accessibilityLabel="OTP code"
        />
        <Text style={[styles.otpHint, { color: c.muted }]}>Demo: enter any 6 digits.</Text>
      </FadeInUp>

      <View style={{ marginTop: space.xl }}>
        {sending ? (
          <View style={[styles.sending, { backgroundColor: c.primary }]}>
            <ActivityIndicator color={c.onPrimary} />
            <Text style={{ color: c.onPrimary, fontWeight: '700', fontSize: 16 }}>Processing…</Text>
          </View>
        ) : (
          <Button label="Confirm" onPress={confirm} disabled={otp.length < OTP_LENGTH} />
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
  otpHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  otpTitle: { fontSize: 16, fontWeight: '800' },
  otpBoxes: { flexDirection: 'row', justifyContent: 'space-between' },
  otpBox: { width: 48, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  otpDigit: { fontSize: 28, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  otpHint: { fontSize: 12, textAlign: 'center', marginTop: space.sm },
  sending: { flexDirection: 'row', gap: space.sm, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
});
