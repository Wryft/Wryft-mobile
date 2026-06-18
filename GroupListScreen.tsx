import { useState, useLayoutEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { nip19 } from 'nostr-tools';
import { useColors } from './colors';
import { useNostr } from './NostrContext';
import { useRelay } from './RelayContext';
import { useGroupChannels, createPrivateGroup, type GroupChannel } from './useGroups';
import { useContactList } from './useContacts';
import { CheckCircle } from 'phosphor-react-native';

export default function GroupListScreen({ navigation }: any) {
  const c = useColors();
  const { publicKey: userPubkey, nsec } = useNostr();
  const { publish } = useRelay();
  const { channels, loading } = useGroupChannels(userPubkey);
  const { contacts } = useContactList(userPubkey);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbout, setNewAbout] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !nsec || creating) return;
    setCreating(true);
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type !== 'nsec') return;
      const members = [userPubkey, ...selectedMembers];
      const id = await createPrivateGroup(newName.trim(), newAbout.trim() || undefined, members, decoded.data as Uint8Array, publish);
      setShowCreate(false);
      setNewName('');
      setNewAbout('');
      setSelectedMembers([]);
      navigation.navigate('GroupDetail', { channelId: id });
    } catch (e) {
      console.error('create group failed', e);
    }
    setCreating(false);
  };

  const toggleMember = (pubkey: string) => {
    setSelectedMembers(prev => prev.includes(pubkey) ? prev.filter(p => p !== pubkey) : [...prev, pubkey]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={channels}
        keyExtractor={(item: GroupChannel) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          loading ? <ActivityIndicator size="small" color={c.textMuted} style={{ marginTop: 40 }} />
          : <Text style={[styles.empty, { color: c.textMuted }]}>No groups yet</Text>
        }
        renderItem={({ item }: { item: GroupChannel }) => (
          <TouchableOpacity
            style={styles.row} activeOpacity={0.7}
            onPress={() => navigation.navigate('GroupDetail', { channelId: item.id, members: item.members })}
          >
            <View style={[styles.avatar, { backgroundColor: c.bgCard }]}>
              <Text style={[styles.avatarText, { color: c.textMuted }]}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.content}>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.about, { color: c.textSecondary }]} numberOfLines={1}>
                {item.members.length} members
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity onPress={() => setShowCreate(true)} style={[styles.fab, { backgroundColor: c.accent }]}>
        <Text style={[styles.fabText, { color: c.bg }]}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: c.bgCard }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { color: c.text }]}>New Private Group</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Group name"
              placeholderTextColor={c.textMuted}
            />
            <TextInput
              style={[styles.input, styles.inputAbout, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
              value={newAbout}
              onChangeText={setNewAbout}
              placeholder="Description"
              placeholderTextColor={c.textMuted}
              multiline
            />
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>ADD MEMBERS</Text>
            {contacts.map(contact => {
              const sel = selectedMembers.includes(contact.pubkey);
              return (
                <TouchableOpacity key={contact.pubkey} style={styles.memberRow} onPress={() => toggleMember(contact.pubkey)}>
                  <View style={[styles.memberAvatar, { backgroundColor: c.bgInput }]}>
                    <Text style={[styles.memberAvatarText, { color: c.textMuted }]}>{contact.pubkey.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.memberName, { color: c.text }]}>{contact.pubkey.slice(0, 12)}...</Text>
                  {sel && <CheckCircle size={20} color={c.accent} weight="fill" />}
                </TouchableOpacity>
              );
            })}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalBtn}>
                <Text style={{ color: c.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={creating || !newName.trim()}
                style={[styles.modalBtn, { backgroundColor: c.accent, opacity: creating || !newName.trim() ? 0.5 : 1 }]}
              >
                <Text style={{ color: c.bg, fontWeight: '600' }}>{creating ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  about: { fontSize: 13, marginTop: 2 },
  fab: {
    position: 'absolute', right: 16, bottom: 20, width: 50, height: 50,
    borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  fabText: { fontSize: 24, fontWeight: '400', lineHeight: 26 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: { width: '90%', maxHeight: '80%', borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 12,
  },
  inputAbout: { minHeight: 60, textAlignVertical: 'top' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  memberAvatarText: { fontSize: 12, fontWeight: '600' },
  memberName: { flex: 1, fontSize: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
