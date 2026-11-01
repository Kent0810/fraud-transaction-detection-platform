import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeInUp } from '@/components/motion';
import { pickQrImage } from '@/components/qr-image';
import { Button, IconBubble } from '@/components/ui';
import { vnd } from '@/components/vnd';
import { HttpError, apiEnabled } from '@/data/http';
import { resolveQr } from '@/data/queries';
import type { QrTarget } from '@/data/types';
import { radius, space, useColors } from '@/theme';

type OtherBank = Extract<QrTarget, { kind: 'OTHER_BANK' }>;

const why = (e: unknown) =>
  e instanceof HttpError ? (e.detail ?? 'The bank could not read this code') : 'Could not reach the bank';

// Scan a VietQR code: one of ours opens a prefilled transfer or the payment sheet; another bank's is shown, not paid.
export default function ScanScreen() {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState<OtherBank | null>(null);
  const [pasted, setPasted] = useState('');
  // The camera reports the same code many times a second; read each one once.
  const busy = useRef(false);

  const open = async (payload: string) => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setError(null);
    setOther(null);
    try {
      const target = await resolveQr(payload);
      if (target.kind === 'TRANSFER') {
        router.replace({
          pathname: '/transfer',
          params: { account: target.account, amount: target.amount ?? '', note: target.note ?? '' },
        });
      } else if (target.kind === 'MERCHANT') {
        const m = target.merchant;
        router.replace({
          pathname: '/pay',
          params: {
            merchantId: m.merchantId,
            name: m.name,
            category: m.category,
            distanceKm: m.distanceKm ?? '',
            amount: target.amount ?? '',
            qr: target.qr,
          },
        });
      } else {
        setCameraOn(false);
        setOther(target);
      }
    } catch (e) {
      setError(why(e));
    } finally {
      setChecking(false);
      // Give the user a moment to move the camera off a code that was refused.
      setTimeout(() => (busy.current = false), 1500);
    }
  };

  const startCamera = async () => {
    if (!permission?.granted && !(await requestPermission()).granted) {
      setError('Camera access was not allowed. Upload a picture of the code instead.');
      return;
    }
    setOther(null);
    setCameraOn(true);
  };

  const upload = async () => {
    setError(null);
    const payload = await pickQrImage();
    if (payload) await open(payload);
    else setError('No QR code found in that picture.');
  };

  if (!apiEnabled) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.muted, textAlign: 'center' }}>
          Scanning needs the bank connection (demo data only).
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.viewfinder, { backgroundColor: c.surfaceAlt }]}>
        {cameraOn ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => open(data)}
          />
        ) : (
          <Pressable onPress={startCamera} style={styles.center} accessibilityRole="button">
            <IconBubble name="scan" tint={c.primary} bg={c.primarySoft} size={72} />
            <Text style={[styles.hint, { color: c.text }]}>Tap to scan with the camera</Text>
          </Pressable>
        )}
        {checking && (
          <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Checking the code…</Text>
          </View>
        )}
      </View>

      <Text style={[styles.caption, { color: c.muted }]}>
        VietQR codes from any Vietnamese bank: accounts, and merchants at this bank.
      </Text>

      {error && (
        <FadeInUp style={[styles.banner, { backgroundColor: c.declineBg }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.decline} />
          <Text style={[styles.bannerText, { color: c.decline }]}>{error}</Text>
        </FadeInUp>
      )}

      {other && (
        <FadeInUp style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {other.bank?.code ?? `Bank ${other.bin}`} {other.toCard ? 'card' : 'account'}
          </Text>
          {[
            ...(other.name ? [['Name', other.name]] : []),
            [other.toCard ? 'Card' : 'Account', other.account],
            ...(other.amount ? [['Amount', vnd(other.amount)]] : []),
            ...(other.note ? [['Message', other.note]] : []),
          ].map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
              <Text style={[styles.val, { color: c.text }]}>{v}</Text>
            </View>
          ))}
          {other.bank && !other.toCard ? (
            <>
              {!other.name && (
                <View style={[styles.note, { backgroundColor: c.stepUpBg }]}>
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                    {
                      "This code doesn't include the account holder's name, and only NAPAS member banks can look it up. "
                    }
                    Ask the recipient and type it on the next screen.
                  </Text>
                </View>
              )}
              <Button
                label="Send money"
                icon="paper-plane-outline"
                onPress={() =>
                  router.replace({
                    pathname: '/transfer',
                    params: {
                      bank: other.bin,
                      account: other.account,
                      name: other.name ?? '',
                      amount: other.amount ?? '',
                      note: other.note ?? '',
                    },
                  })
                }
              />
            </>
          ) : (
            <View style={[styles.note, { backgroundColor: c.stepUpBg }]}>
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                {other.toCard
                  ? 'Transfers to a card number are not supported. Ask for the account number instead.'
                  : 'Transfers to this bank are not supported.'}
              </Text>
            </View>
          )}
        </FadeInUp>
      )}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {Platform.OS === 'web' && (
          <Button label="Upload a QR picture" icon="image-outline" variant="secondary" onPress={upload} />
        )}
        <Button label="Show my QR" icon="qr-code-outline" variant="secondary" onPress={() => router.push('/my-qr')} />
      </View>

      <Text style={[styles.section, { color: c.muted }]}>Or paste the code text</Text>
      <View style={[styles.pasteRow, { backgroundColor: c.surface }]}>
        <TextInput
          value={pasted}
          onChangeText={setPasted}
          placeholder="000201010211…"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.pasteInput, { color: c.text }]}
        />
        <Pressable
          onPress={() => pasted.trim() && open(pasted.trim())}
          disabled={!pasted.trim() || checking}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="arrow-forward-circle" size={30} color={pasted.trim() ? c.primary : c.border} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  viewfinder: { height: 300, borderRadius: radius.xl, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  hint: { fontSize: 15, fontWeight: '600' },
  overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  overlayText: { color: '#fff', fontWeight: '700' },
  caption: { fontSize: 13, textAlign: 'center', marginTop: space.md, lineHeight: 18 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginTop: space.md },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  note: { borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  section: { fontSize: 13, fontWeight: '600', marginTop: space.xl, marginBottom: space.sm },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  pasteInput: { flex: 1, fontSize: 14, paddingVertical: 14 },
});
