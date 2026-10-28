import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bank } from '@/data/types';
import { radius, space, useColors } from '@/theme';

type Props = {
  visible: boolean;
  banks: Bank[];
  selected?: string;
  onSelect: (bank: Bank) => void;
  onClose: () => void;
};

export function BankPicker({ visible, banks, selected, onSelect, onClose }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = banks.filter((b) => !q || b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>Choose recipient bank</Text>
        <View style={[styles.search, { backgroundColor: c.surface }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by bank name or code"
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.text }]}
          />
        </View>
        <FlatList
          data={shown}
          keyExtractor={(b) => b.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = item.code === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                }}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.code, { backgroundColor: c.primarySoft }]}>
                  <Text style={[styles.codeText, { color: c.primary }]}>{item.code}</Text>
                </View>
                <Text style={[styles.name, { color: c.text }]}>{item.name}</Text>
                {on && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={[styles.none, { color: c.muted }]}>No bank found</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: space.sm, marginBottom: space.md },
  title: { fontSize: 18, fontWeight: '800', marginBottom: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  code: { width: 56, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 13, fontWeight: '800' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  none: { textAlign: 'center', paddingVertical: space.xl },
});
