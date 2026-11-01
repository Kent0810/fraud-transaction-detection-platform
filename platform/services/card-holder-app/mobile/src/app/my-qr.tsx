import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BANK_NAME } from '@/components/brand';
import { accountNumber as printAccount } from '@/components/format';
import { PopIn } from '@/components/motion';
import { QrCode } from '@/components/QrCode';
import { Empty } from '@/components/ui';
import { apiEnabled } from '@/data/http';
import { fetchMyQr } from '@/data/queries';
import type { MyQr } from '@/data/types';
import { radius, shadow, space, useColors } from '@/theme';

// The cardholder's VietQR: another customer of this bank scans it to send money here.
export default function MyQrScreen() {
  const c = useColors();
  const [qr, setQr] = useState<MyQr | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (apiEnabled) fetchMyQr().then(setQr, () => setError('Could not load your code. Try again later.'));
  }, []);

  if (!apiEnabled || error) {
    return <Empty icon="qr-code-outline" title="Code not available" detail={error ?? 'Needs the bank connection.'} />;
  }
  if (!qr) return <ActivityIndicator color={c.primary} style={{ marginTop: space.xxl }} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PopIn>
        <View style={[styles.card, { backgroundColor: c.surface }, shadow(c)]}>
          <Text style={[styles.bank, { color: c.muted }]}>{BANK_NAME}</Text>
          <View style={styles.code}>
            <QrCode value={qr.payload} size={240} />
          </View>
          <Text style={[styles.name, { color: c.text }]}>{qr.name}</Text>
          <Text style={[styles.account, { color: c.muted }]}>{printAccount(qr.account)}</Text>
        </View>
      </PopIn>
      <Text style={[styles.hint, { color: c.muted }]}>
        Show this to someone at {BANK_NAME} to receive a transfer. It is a standard VietQR code.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, alignItems: 'stretch', gap: space.lg },
  card: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.sm },
  bank: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  code: { borderRadius: radius.md, overflow: 'hidden', marginVertical: space.md },
  name: { fontSize: 18, fontWeight: '800' },
  account: { fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
