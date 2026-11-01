import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { accountNumber as printAccount } from '@/components/format';
import { FadeInUp, stagger } from '@/components/motion';
import { Empty, SectionHeader, Surface } from '@/components/ui';
import { useUser } from '@/data/auth';
import { apiEnabled } from '@/data/http';
import { ACCOUNT } from '@/data/mock';
import { fetchProfile } from '@/data/queries';
import type { Profile } from '@/data/types';
import { space, useColors } from '@/theme';

const GENDER: Record<string, string> = { F: 'Female', M: 'Male' };

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// Keeps only the last 4 characters: what anyone looking over the shoulder may see.
const mask = (s: string) => `${'•'.repeat(Math.max(0, Math.min(s.length - 4, 12)))}${s.slice(-4)}`;

// The cardholder's own details. Hidden until asked for, so the screen is safe to open in public.
export default function ProfileScreen() {
  const c = useColors();
  const user = useUser();
  // Offline, the demo user is all there is; live, the bank has the full record.
  const [profile, setProfile] = useState<Profile | null>(() =>
    apiEnabled
      ? null
      : {
          cardId: user.cardId,
          accountNumber: ACCOUNT.number,
          name: user.name,
          email: user.email ?? '',
          gender: null,
          dob: null,
          address: null,
          job: null,
          memberSince: new Date().toISOString(),
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (apiEnabled) fetchProfile().then(setProfile, () => setError('Could not load your details. Try again later.'));
  }, []);

  if (error) return <Empty icon="person-outline" title="Details not available" detail={error} />;
  if (!profile) return <ActivityIndicator color={c.primary} style={{ marginTop: space.xxl }} />;

  const secret = (value: string) => (shown ? value : mask(value));
  const card: [string, string][] = [
    ['Card number', shown ? printAccount(profile.cardId) : mask(profile.cardId)],
    ['Account number', shown ? printAccount(profile.accountNumber) : mask(profile.accountNumber)],
    ['Name on card', profile.name.toUpperCase()],
    ['Member since', longDate(profile.memberSince)],
  ];
  const personal: [string, string][] = [
    ['Email', secret(profile.email)],
    ...(profile.dob ? [['Date of birth', shown ? longDate(profile.dob) : '•• •••• ••••'] as [string, string]] : []),
    ...(profile.gender ? [['Gender', GENDER[profile.gender] ?? profile.gender] as [string, string]] : []),
    ...(profile.address ? [['Address', shown ? profile.address : '••••••••'] as [string, string]] : []),
    ...(profile.job ? [['Occupation', profile.job] as [string, string]] : []),
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FadeInUp style={styles.head}>
        <Avatar name={profile.name} size={72} />
        <Text style={[styles.name, { color: c.text }]}>{profile.name}</Text>
        <Pressable
          onPress={() => setShown((s) => !s)}
          accessibilityRole="button"
          style={[styles.reveal, { backgroundColor: c.primarySoft }]}
        >
          <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.primary} />
          <Text style={[styles.revealText, { color: c.primary }]}>{shown ? 'Hide details' : 'Show details'}</Text>
        </Pressable>
      </FadeInUp>

      <FadeInUp delay={stagger(1)}>
        <SectionHeader title="Card" />
        <Rows rows={card} />
      </FadeInUp>
      <FadeInUp delay={stagger(2)}>
        <SectionHeader title="Personal" />
        <Rows rows={personal} />
      </FadeInUp>
      <Text style={[styles.hint, { color: c.muted }]}>
        To change these details, contact the bank. Nobody from the bank will ask you for your password.
      </Text>
    </ScrollView>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  const c = useColors();
  return (
    <Surface style={styles.group}>
      {rows.map(([k, v], i) => (
        <View
          key={k}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
        >
          <Text style={[styles.key, { color: c.muted }]}>{k}</Text>
          <Text style={[styles.val, { color: c.text }]} selectable>
            {v}
          </Text>
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  head: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  name: { fontSize: 20, fontWeight: '800' },
  reveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: space.xs,
  },
  revealText: { fontSize: 14, fontWeight: '700' },
  group: { paddingVertical: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: space.xl, lineHeight: 17 },
});
