import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/data/settings';
import { USERS } from '@/data/users';
import { radius, space, useColors } from '@/theme';

import { Avatar } from './Avatar';

export function UserSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { userId, update } = useSettings();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>Switch account</Text>
        {USERS.map((u) => {
          const on = u.id === userId;
          return (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                onClose();
                if (!on) update('userId', u.id);
              }}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: c.surface, borderColor: on ? c.primary : 'transparent', opacity: pressed ? 0.7 : 1 },
              ]}>
              <Avatar name={u.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>{u.name}</Text>
                <Text style={[styles.meta, { color: c.muted }]}>Card •••• {u.cardId.slice(-4)}</Text>
              </View>
              {on && <Ionicons name="checkmark-circle" size={24} color={c.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, gap: space.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: space.sm, marginBottom: space.sm },
  title: { fontSize: 18, fontWeight: '800', marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
});
