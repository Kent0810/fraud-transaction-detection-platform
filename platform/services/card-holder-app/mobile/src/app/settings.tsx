import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button, SectionHeader, Surface } from '@/components/ui';
import { useAuth, useUser } from '@/data/auth';
import { useSettings, type Settings } from '@/data/settings';
import { apiEnabled, apiUrl } from '@/data/http';
import { useStore } from '@/data/store';
import { space, useColors } from '@/theme';

export default function SettingsScreen() {
  const c = useColors();
  const settings = useSettings();
  const user = useUser();
  const { logout } = useAuth();
  const { frozen } = useStore();
  const dark = settings.theme === 'dark';

  const toggle = (key: keyof Settings, label: string, detail?: string) => (
    <Row label={label} detail={detail}>
      <Switch
        value={settings[key] as boolean}
        onValueChange={(v) => settings.update(key, v as never)}
        trackColor={{ true: c.primary, false: c.border }}
        accessibilityLabel={label}
      />
    </Row>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Surface style={styles.profile}>
        <Avatar name={user.name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]}>{user.name}</Text>
          <Text style={[styles.muted, { color: c.muted }]}>{user.email}</Text>
          <Text style={[styles.muted, { color: c.muted }]}>
            Card •••• {user.cardId.slice(-4)} · member since {user.memberSince}
          </Text>
        </View>
      </Surface>

      <SectionHeader title="Appearance" />
      <Surface style={styles.group}>
        <Row label="Dark mode">
          <Switch
            value={dark}
            onValueChange={(v) => settings.update('theme', v ? 'dark' : 'light')}
            trackColor={{ true: c.primary, false: c.border }}
            accessibilityLabel="Dark mode"
          />
        </Row>
      </Surface>

      <SectionHeader title="Privacy & security" />
      <Surface style={styles.group}>
        {toggle('hideBalance', 'Hide balance', 'Show •••• on the home screen')}
        <Divider />
        {toggle('biometrics', 'Face ID / fingerprint', 'Unlock the app and approve transfers')}
        <Divider />
        <Row
          label="Freeze card"
          detail={frozen ? 'Frozen: card payments and transfers are blocked' : 'Blocks card payments and transfers'}
        >
          {/* Opens the confirm screen; the switch flips only once the bank has saved the change. */}
          <Switch
            value={frozen}
            onValueChange={() => router.push('/card/freeze')}
            trackColor={{ true: c.primary, false: c.border }}
            accessibilityLabel="Freeze card"
          />
        </Row>
      </Surface>

      <SectionHeader title="Notifications" />
      <Surface style={styles.group}>
        {toggle('notifyDeclines', 'Suspicious payments', 'When we flag or decline a payment')}
        <Divider />
        {toggle('notifyBudget', 'Budget alerts', 'When you get close to your limit')}
        <Divider />
        {toggle('notifyTransfers', 'Transfer receipts', 'When money leaves your account')}
      </Surface>

      <SectionHeader title="About" />
      <Surface style={styles.group}>
        <Row label="Version" detail="1.0.0 · demo build" />
        <Divider />
        <Row
          label="Card data"
          detail={
            apiEnabled
              ? `Live from ${apiUrl} (queries: Cassandra, commands: Kafka)`
              : 'Mock data (set EXPO_PUBLIC_API_URL to go live)'
          }
        />
        <Divider />
        <Row label="Transfers, budget, merchants" detail="Mock data for now" />
      </Surface>

      <View style={styles.logout}>
        <Button label="Log out" variant="danger" onPress={logout} />
      </View>
    </ScrollView>
  );
}

function Row({ label, detail, children }: { label: string; detail?: string; children?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {detail && <Text style={[styles.rowDetail, { color: c.muted }]}>{detail}</Text>}
      </View>
      {children}
    </View>
  );
}

function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { fontSize: 18, fontWeight: '600' },
  muted: { fontSize: 14, marginTop: 2 },
  group: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowLabel: { fontSize: 16 },
  rowDetail: { fontSize: 13, marginTop: 2 },
  logout: { marginTop: space.xl },
});
