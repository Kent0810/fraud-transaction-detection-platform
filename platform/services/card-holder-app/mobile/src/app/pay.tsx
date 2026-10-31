import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { category, categoryIcon } from '@/components/format';
import { FadeInUp, PopIn, ScalePressable, stagger } from '@/components/motion';
import { Button, Empty, IconBubble } from '@/components/ui';
import { groupThousands, parseVnd, vnd, vndInWords } from '@/components/vnd';
import { useUser } from '@/data/auth';
import { newTransferId } from '@/data/commands';
import { ruleTitle } from '@/data/rules';
import { PaymentError, useStore } from '@/data/store';
import type { PayMerchant, Payment } from '@/data/types';
import { radius, shadow, space, useColors, type Colors } from '@/theme';

const QUICK = [50_000, 100_000, 200_000, 500_000];
const MIN_AMOUNT = 1_000;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

type IconName = keyof typeof Ionicons.glyphMap;

const RESULT: Record<Payment['status'], (c: Colors) => { icon: IconName; title: string; tint: string; bg: string }> = {
  POSTED: (c) => ({ icon: 'checkmark', title: 'Payment approved', tint: c.allow, bg: c.allowBg }),
  PENDING: (c) => ({ icon: 'hourglass-outline', title: 'Being checked', tint: c.stepUp, bg: c.stepUpBg }),
  DECLINED: (c) => ({ icon: 'close', title: 'Payment declined', tint: c.decline, bg: c.declineBg }),
};

type QrParams = {
  merchantId?: string;
  name?: string;
  category?: string;
  distanceKm?: string;
  amount?: string;
  qr?: string;
};

// Tap to pay at a merchant nearby: pick the merchant and amount, confirm with the password, see the bank's answer.
// Opened from a scanned merchant QR, the merchant is fixed, and so is the amount when the code carries one.
// The payment goes through the same fraud check and ledger as a card payment from the network.
export default function PayScreen() {
  const c = useColors();
  const user = useUser();
  const { balance, frozen, merchantsNearby, pay } = useStore();
  const scanned = useLocalSearchParams<QrParams>();
  const fromQr: PayMerchant | null =
    scanned.merchantId && scanned.name && scanned.category && scanned.qr
      ? {
          merchantId: scanned.merchantId,
          name: scanned.name,
          category: scanned.category,
          distanceKm: scanned.distanceKm ? Number(scanned.distanceKm) : null,
        }
      : null;
  const fixedAmount = fromQr && scanned.amount ? Number(scanned.amount) : null;

  const [merchants, setMerchants] = useState<PayMerchant[] | null>(fromQr ? [fromQr] : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<PayMerchant | null>(fromQr);
  const [amountText, setAmountText] = useState(fixedAmount ? groupThousands(fixedAmount) : '');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Payment | null>(null);
  // One id per payment attempt: pressing Pay again after a timeout retries the same payment, never a second one.
  const [paymentId, setPaymentId] = useState(newTransferId);

  const qrMerchantId = fromQr?.merchantId;
  useEffect(() => {
    if (qrMerchantId) return;
    merchantsNearby().then(setMerchants, (e: unknown) => setLoadError(message(e)));
  }, [merchantsNearby, qrMerchantId]);

  const amount = parseVnd(amountText);
  const amountError =
    amount > balance ? 'Insufficient balance' : amount > 0 && amount < MIN_AMOUNT ? `Minimum ${vnd(MIN_AMOUNT)}` : null;
  const valid = !!merchant && amount >= MIN_AMOUNT && !amountError && !frozen;

  const submit = async () => {
    if (!merchant || !password || paying) return;
    setPaying(true);
    setError(null);
    try {
      setResult(await pay(merchant, amount, paymentId, password, fromQr ? scanned.qr : undefined));
    } catch (e) {
      setError(e instanceof PaymentError ? e.message : `Could not pay: ${message(e)}`);
      setPassword('');
    } finally {
      setPaying(false);
    }
  };

  const again = () => {
    setResult(null);
    setConfirming(false);
    setPassword('');
    setAmountText(fixedAmount ? groupThousands(fixedAmount) : '');
    setPaymentId(newTransferId());
  };

  if (result) {
    const look = RESULT[result.status](c);
    return (
      <ScrollView contentContainerStyle={styles.resultWrap} showsVerticalScrollIndicator={false}>
        <View style={styles.resultTop}>
          <PopIn>
            <IconBubble name={look.icon} tint={look.tint} bg={look.bg} size={80} />
          </PopIn>
          <FadeInUp delay={200} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.resultTitle, { color: look.tint }]}>{look.title}</Text>
            <Text style={[styles.resultAmount, { color: c.text }]}>{vnd(result.amount)}</Text>
            <Text style={[styles.resultMerchant, { color: c.muted }]}>{result.merchant}</Text>
            <Text style={[styles.resultRef, { color: c.muted }]}>Ref. {result.reference}</Text>
          </FadeInUp>
          {result.status !== 'POSTED' && (
            <View style={[styles.note, { backgroundColor: look.bg }]}>
              <Text style={[styles.noteText, { color: c.text }]}>
                {result.status === 'PENDING'
                  ? 'Our fraud check is still looking at this payment. No money has left your account yet.'
                  : `No money left your account. Reason: ${result.declinedFor.map(ruleTitle).join(', ')}.`}
              </Text>
            </View>
          )}
        </View>
        <FadeInUp delay={350} style={{ gap: space.sm }}>
          <Button label="Back to Home" onPress={() => router.dismissTo('/')} />
          <Button label="Pay again" variant="secondary" onPress={again} />
        </FadeInUp>
      </ScrollView>
    );
  }

  if (loadError) {
    return <Empty icon="cloud-offline-outline" title="Could not load merchants" detail={loadError} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {frozen && (
          <View style={[styles.note, { backgroundColor: c.primarySoft, marginBottom: space.lg }]}>
            <Text style={[styles.noteText, { color: c.text }]}>Your card is frozen. Unfreeze it to pay.</Text>
          </View>
        )}

        <Text style={[styles.section, { color: c.text }]}>{fromQr ? 'Paying by QR code' : 'Nearby merchants'}</Text>
        {!merchants ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: space.xl }} />
        ) : (
          <View style={[styles.list, { backgroundColor: c.surface }, shadow(c)]}>
            {merchants.map((m, i) => {
              const on = merchant?.merchantId === m.merchantId;
              return (
                <FadeInUp key={m.merchantId} delay={stagger(i, 40)}>
                  <Pressable
                    onPress={() => !confirming && setMerchant(m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.merchant,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <IconBubble
                      name={categoryIcon(m.category)}
                      tint={on ? c.onPrimary : c.primary}
                      bg={on ? c.primary : c.primarySoft}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.merchantName, { color: c.text }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={[styles.merchantMeta, { color: c.muted }]} numberOfLines={1}>
                        {category(m.category)}
                        {m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}
                      </Text>
                    </View>
                    {on && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
                  </Pressable>
                </FadeInUp>
              );
            })}
          </View>
        )}

        <Text style={[styles.section, { color: c.text }]}>Amount</Text>
        <View style={[styles.amountCard, { backgroundColor: c.surface }, shadow(c)]}>
          <View style={styles.amountRow}>
            <TextInput
              value={amountText}
              onChangeText={(t) => {
                const n = parseVnd(t);
                setAmountText(n ? groupThousands(Math.min(n, 999_999_999_999)) : '');
              }}
              editable={!confirming && !fixedAmount}
              placeholder="0"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              style={[styles.amountInput, { color: amountError ? c.decline : c.text }]}
            />
            <Text style={[styles.currency, { color: c.muted }]}>VND</Text>
          </View>
          {amountError ? (
            <Text style={[styles.hint, { color: c.decline }]}>{amountError}</Text>
          ) : fixedAmount ? (
            <Text style={[styles.hint, { color: c.muted }]}>Set by the merchant in the QR code</Text>
          ) : amount > 0 ? (
            <Text style={[styles.words, { color: c.primary }]}>{vndInWords(amount)}</Text>
          ) : (
            <Text style={[styles.hint, { color: c.muted }]}>Available {vnd(balance)}</Text>
          )}
          {!fixedAmount && (
            <View style={styles.quick}>
              {QUICK.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => !confirming && setAmountText(groupThousands(q))}
                  style={[styles.chip, { backgroundColor: amount === q ? c.primarySoft : c.surfaceAlt }]}
                >
                  <Text style={{ color: amount === q ? c.primary : c.text, fontWeight: '700', fontSize: 13 }}>
                    {groupThousands(q)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {!confirming ? (
          <View style={{ marginTop: space.xl }}>
            <Button label="Continue" icon="wallet-outline" onPress={() => setConfirming(true)} disabled={!valid} />
          </View>
        ) : (
          merchant && (
            <FadeInUp style={[styles.sheet, { backgroundColor: c.surface }, shadow(c)]}>
              <View style={styles.sheetHead}>
                <LinearGradient
                  colors={[c.cardFrom, c.cardTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.miniCard}
                >
                  <Text style={styles.miniCardText}>•••• {user.cardId.slice(-4)}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetMerchant, { color: c.text }]} numberOfLines={1}>
                    {merchant.name}
                  </Text>
                  <Text style={[styles.merchantMeta, { color: c.muted }]}>{category(merchant.category)}</Text>
                </View>
                <Text style={[styles.sheetAmount, { color: c.text }]}>{vnd(amount)}</Text>
              </View>

              <View style={[styles.passwordRow, { backgroundColor: c.surfaceAlt }]}>
                <Ionicons name="lock-closed-outline" size={18} color={c.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password to confirm"
                  placeholderTextColor={c.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  editable={!paying}
                  accessibilityLabel="Password"
                  style={[styles.passwordInput, { color: c.text }]}
                />
              </View>
              {error && (
                <View style={[styles.error, { backgroundColor: c.declineBg }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
                  <Text style={[styles.errorText, { color: c.decline }]}>{error}</Text>
                </View>
              )}

              {paying ? (
                <View style={[styles.paying, { backgroundColor: c.primary }]}>
                  <ActivityIndicator color={c.onPrimary} />
                  <Text style={{ color: c.onPrimary, fontWeight: '700', fontSize: 16 }}>Paying…</Text>
                </View>
              ) : (
                <View style={{ gap: space.sm }}>
                  <Button label={`Pay ${vnd(amount)}`} icon="wallet" onPress={submit} disabled={!password} />
                  <ScalePressable onPress={() => setConfirming(false)} style={styles.cancel}>
                    <Text style={[styles.cancelText, { color: c.muted }]}>Change</Text>
                  </ScalePressable>
                </View>
              )}
            </FadeInUp>
          )
        )}
        <Text style={[styles.demo, { color: c.muted }]}>Demo only. No real money is moved.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  section: { fontSize: 16, fontWeight: '800', marginTop: space.lg, marginBottom: space.sm },
  list: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  merchant: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  merchantName: { fontSize: 16, fontWeight: '600' },
  merchantMeta: { fontSize: 13, marginTop: 3 },
  amountCard: { borderRadius: radius.lg, padding: space.lg, gap: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 2 },
  currency: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13 },
  words: { fontSize: 13, fontStyle: 'italic' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill },
  sheet: { borderRadius: radius.xl, padding: space.lg, gap: space.md, marginTop: space.xl },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  miniCard: { width: 64, height: 42, borderRadius: radius.sm, justifyContent: 'flex-end', padding: 6 },
  miniCardText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sheetMerchant: { fontSize: 16, fontWeight: '700' },
  sheetAmount: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  passwordInput: { flex: 1, fontSize: 16, paddingVertical: 14 },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  paying: {
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { alignItems: 'center', paddingVertical: space.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  demo: { fontSize: 12, textAlign: 'center', marginTop: space.xl },
  resultWrap: { flexGrow: 1, padding: space.lg, justifyContent: 'space-between', gap: space.xl },
  resultTop: { alignItems: 'center', gap: space.md, paddingTop: space.xxl },
  resultTitle: { fontSize: 16, fontWeight: '800' },
  resultAmount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  resultMerchant: { fontSize: 15, fontWeight: '600' },
  resultRef: { fontSize: 13 },
  note: { borderRadius: radius.md, padding: space.md, alignSelf: 'stretch' },
  noteText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
