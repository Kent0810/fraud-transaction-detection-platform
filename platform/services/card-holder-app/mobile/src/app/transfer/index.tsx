import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BankPicker } from '@/components/BankPicker';
import { accountNumber as printAccount } from '@/components/format';
import { FadeInUp, ScalePressable, stagger } from '@/components/motion';
import { Button } from '@/components/ui';
import { groupThousands, parseVnd, toAccountName, vnd, vndInWords } from '@/components/vnd';
import { ACCOUNT } from '@/data/mock';
import { useUser } from '@/data/auth';
import { useSettings } from '@/data/settings';
import { useStore } from '@/data/store';
import type { Recipient, TransferKind } from '@/data/types';
import { radius, space, useColors } from '@/theme';

const QUICK = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];
const MIN_AMOUNT = 1_000;

type Lookup = { state: 'idle' | 'checking' | 'notfound' | 'self' } | { state: 'found'; name: string };

export default function TransferFormScreen() {
  const c = useColors();
  const { balance, accountNumber, banks, saved, lookupAccount, setDraft, removeSaved } = useStore();
  const { hideBalance, update } = useSettings();
  const user = useUser();

  const [bankCode, setBankCode] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [result, setResult] = useState<{ key: string; name: string | null } | null>(null);
  const [amountText, setAmountText] = useState('');
  const [content, setContent] = useState(`${toAccountName(user.name)} transfer`);
  const [save, setSave] = useState(false);
  const [picking, setPicking] = useState(false);

  // Our own bank in the list means an internal transfer; any other goes through NAPAS.
  const kind: TransferKind = bankCode === ACCOUNT.bankCode ? 'INTERNAL' : 'NAPAS';
  const bank = banks.find((b) => b.code === bankCode);
  const amount = parseVnd(amountText);
  const alreadySaved = saved.some((r) => r.bankCode === bankCode && r.account === account);
  const toSelf = kind === 'INTERNAL' && account === accountNumber;

  const lookupKey = bankCode && account.length >= 6 && !toSelf ? `${bankCode}|${account}` : null;
  useEffect(() => {
    if (!lookupKey || !bankCode) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const name = await lookupAccount(bankCode, account).catch(() => null);
      if (!cancelled) setResult({ key: lookupKey, name });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lookupKey, bankCode, account, lookupAccount]);

  const lookup: Lookup = toSelf
    ? { state: 'self' }
    : !lookupKey
    ? { state: 'idle' }
    : result?.key !== lookupKey
      ? { state: 'checking' }
      : result.name
        ? { state: 'found', name: result.name }
        : { state: 'notfound' };

  const amountError =
    amount > balance ? 'Insufficient balance' : amount > 0 && amount < MIN_AMOUNT ? `Minimum ${vnd(MIN_AMOUNT)}` : null;
  const valid = lookup.state === 'found' && amount >= MIN_AMOUNT && !amountError && content.trim().length > 0;

  const pickSaved = (r: Recipient) => {
    setBankCode(r.bankCode);
    setAccount(r.account);
  };

  const next = () => {
    if (lookup.state !== 'found' || !bankCode) return;
    setDraft({
      kind,
      to: { bankCode, account, name: lookup.name },
      amount,
      content: content.trim(),
      save: save && !alreadySaved,
    });
    router.push('/transfer/confirm');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeInUp>
          <LinearGradient colors={[c.cardFrom, c.cardTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.source}>
            <Text style={styles.sourceLabel}>From account</Text>
            <Text style={styles.sourceNumber}>
              {ACCOUNT.label} · {printAccount(accountNumber)}
            </Text>
            <View style={styles.sourceRow}>
              <View>
                <Text style={styles.sourceLabel}>Available balance</Text>
                <Text style={styles.sourceBalance}>{hideBalance ? '•••••• đ' : vnd(balance)}</Text>
              </View>
              <Pressable onPress={() => update('hideBalance', !hideBalance)} hitSlop={12} accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}>
                <Ionicons name={hideBalance ? 'eye-off-outline' : 'eye-outline'} size={22} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>
          </LinearGradient>
        </FadeInUp>

        {saved.length > 0 && (
          <FadeInUp delay={stagger(2)}>
            <Text style={[styles.section, { color: c.text }]}>Saved recipients</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
              {saved.map((r) => {
                const on = r.account === account && r.bankCode === bankCode;
                return (
                  <ScalePressable
                    key={`${r.bankCode}-${r.account}`}
                    onPress={() => pickSaved(r)}
                    style={[styles.savedItem, { backgroundColor: c.surface, borderColor: on ? c.primary : 'transparent' }]}>
                    <Pressable
                      onPress={() => removeSaved(r)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${r.name} from saved recipients`}
                      style={styles.savedRemove}>
                      <Ionicons name="close-circle" size={18} color={c.muted} />
                    </Pressable>
                    <Avatar name={r.name} size={40} />
                    <Text style={[styles.savedName, { color: c.text }]} numberOfLines={1}>
                      {r.name.split(' ').slice(-2).join(' ')}
                    </Text>
                    <Text style={[styles.savedBank, { color: c.muted }]}>{r.bankCode}</Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>
          </FadeInUp>
        )}

        <FadeInUp delay={stagger(3)}>
          <Text style={[styles.section, { color: c.text }]}>Recipient</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Field label="Bank">
              <Pressable onPress={() => setPicking(true)} style={styles.select} accessibilityRole="button">
                {bank ? (
                  <Text style={[styles.value, { color: c.text }]}>
                    <Text style={{ fontWeight: '800' }}>{bank.code}</Text> · {bank.name}
                  </Text>
                ) : (
                  <Text style={[styles.value, { color: c.muted }]}>Choose a bank</Text>
                )}
                <Ionicons name="chevron-down" size={18} color={c.muted} />
              </Pressable>
            </Field>

            <Field label="Account number">
              <TextInput
                value={account}
                onChangeText={(t) => setAccount(t.replace(/\D/g, '').slice(0, 19))}
                placeholder="Enter account number"
                placeholderTextColor={c.muted}
                keyboardType="number-pad"
                editable={!!bankCode}
                style={[styles.input, { color: c.text }]}
              />
            </Field>

            <Field label="Account name" last>
              {lookup.state === 'checking' ? (
                <View style={styles.lookup}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={[styles.value, { color: c.muted }]}>Checking…</Text>
                </View>
              ) : lookup.state === 'found' ? (
                <View style={styles.lookup}>
                  <Ionicons name="checkmark-circle" size={20} color={c.allow} />
                  <Text style={[styles.value, { color: c.text, fontWeight: '800' }]}>{lookup.name}</Text>
                </View>
              ) : lookup.state === 'notfound' ? (
                <Text style={[styles.value, { color: c.decline }]}>Account not found</Text>
              ) : lookup.state === 'self' ? (
                <Text style={[styles.value, { color: c.decline }]}>This is your own account</Text>
              ) : (
                <Text style={[styles.value, { color: c.muted }]}>{!bankCode ? 'Choose a bank first' : 'Filled in automatically'}</Text>
              )}
            </Field>
          </View>
        </FadeInUp>

        <FadeInUp delay={stagger(4)}>
          <Text style={[styles.section, { color: c.text }]}>Transfer details</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Field label="Amount">
              <View style={styles.amountRow}>
                <TextInput
                  value={amountText}
                  onChangeText={(t) => {
                    const n = parseVnd(t);
                    setAmountText(n ? groupThousands(Math.min(n, 999_999_999_999)) : '');
                  }}
                  placeholder="0"
                  placeholderTextColor={c.muted}
                  keyboardType="number-pad"
                  style={[styles.amountInput, { color: amountError ? c.decline : c.text }]}
                />
                <Text style={[styles.currency, { color: c.muted }]}>VND</Text>
              </View>
              {amountError ? (
                <Text style={[styles.hint, { color: c.decline }]}>{amountError}</Text>
              ) : amount > 0 ? (
                <Text style={[styles.words, { color: c.primary }]}>{vndInWords(amount)}</Text>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
                {QUICK.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setAmountText(groupThousands(q))}
                    style={[styles.chip, { backgroundColor: amount === q ? c.primarySoft : c.surfaceAlt }]}>
                    <Text style={{ color: amount === q ? c.primary : c.text, fontWeight: '700', fontSize: 13 }}>
                      {groupThousands(q)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Field>

            <Field label="Message" last>
              <TextInput
                value={content}
                onChangeText={(t) => setContent(t.slice(0, 100))}
                multiline
                placeholder="Enter a message"
                placeholderTextColor={c.muted}
                style={[styles.input, styles.contentInput, { color: c.text }]}
              />
              <Text style={[styles.counter, { color: c.muted }]}>{content.length}/100</Text>
            </Field>
          </View>
        </FadeInUp>

        {!alreadySaved && lookup.state === 'found' && (
          <FadeInUp>
            <View style={[styles.card, styles.saveRow, { backgroundColor: c.surface }]}>
              <Ionicons name="bookmark-outline" size={20} color={c.primary} />
              <Text style={[styles.value, { color: c.text, flex: 1 }]}>Save recipient</Text>
              <Switch value={save} onValueChange={setSave} trackColor={{ true: c.primary, false: c.border }} />
            </View>
          </FadeInUp>
        )}

        <View style={{ marginTop: space.xl }}>
          <Button label="Continue" onPress={next} disabled={!valid} />
        </View>
        <Text style={[styles.demo, { color: c.muted }]}>Demo only. No real money is moved.</Text>
      </ScrollView>

      <BankPicker
        visible={picking}
        banks={banks}
        selected={bankCode ?? undefined}
        onSelect={(b) => {
          setBankCode(b.code);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.field, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  source: { borderRadius: radius.lg, padding: space.lg, gap: 4 },
  sourceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  sourceNumber: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: space.sm },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sourceBalance: { color: '#fff', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  section: { fontSize: 16, fontWeight: '800', marginTop: space.xl, marginBottom: space.sm },
  savedItem: { width: 108, alignItems: 'center', gap: 4, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5 },
  savedName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  savedBank: { fontSize: 11, fontWeight: '600' },
  savedRemove: { position: 'absolute', top: 6, right: 6 },
  card: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  field: { paddingVertical: space.md, gap: 6 },
  label: { fontSize: 13 },
  value: { fontSize: 16 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { fontSize: 16, paddingVertical: 2 },
  contentInput: { minHeight: 44, textAlignVertical: 'top' },
  counter: { fontSize: 11, alignSelf: 'flex-end' },
  lookup: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amountInput: { flex: 1, fontSize: 26, fontWeight: '800', paddingVertical: 2, fontVariant: ['tabular-nums'] },
  currency: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 13 },
  words: { fontSize: 13, fontStyle: 'italic' },
  quick: { gap: space.sm, paddingTop: space.xs },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, marginTop: space.md },
  demo: { textAlign: 'center', fontSize: 12, marginTop: space.lg },
});
