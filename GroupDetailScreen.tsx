import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  Keyboard, ActivityIndicator, Modal, ScrollView, Animated,
} from 'react-native';
import { Globe, UserCircle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nip19 } from 'nostr-tools';
import { useColors } from './colors';
import { useNostr } from './NostrContext';
import { useRelay } from './RelayContext';
import { useGroupMessages, sendPrivateGroupMessage } from './useGroups';
import { useProfiles } from './useProfile';
import useDragClose from './useDragClose';

function formatTimestamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function GroupDetailScreen({ route }: any) {
  const channelId = route.params?.channelId as string;
  const members: string[] = route.params?.members || [];
  const { publicKey: userPubkey, nsec, profile } = useNostr();
  const { publish } = useRelay();
  const { messages, loading } = useGroupMessages(channelId);
  const pubkeys = useMemo(() => [...new Set([...messages.map(m => m.pubkey), userPubkey])], [messages, userPubkey]);
  const profileMap = useProfiles(pubkeys);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [keyboardH, setKeyboardH] = useState(0);
  const [viewProfilePubkey, setViewProfilePubkey] = useState<string | null>(null);
  const profileDrag = useDragClose(() => setViewProfilePubkey(null));

  useEffect(() => {
    if (viewProfilePubkey) profileDrag.panY.setValue(0);
  }, [viewProfilePubkey]);

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardH(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !nsec) return;
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type !== 'nsec') return;
      await sendPrivateGroupMessage(channelId, text.trim(), members, decoded.data as Uint8Array, publish);
      setText('');
    } catch (e) {
      console.error('send failed', e);
    }
  };

  const grouped = useMemo(() => {
    const result: { msg: any; showAvatar: boolean }[] = [];
    for (let i = 0; i < messages.length; i++) {
      const prev = i > 0 ? messages[i - 1] : null;
      result.push({ msg: messages[i], showAvatar: !prev || prev.pubkey !== messages[i].pubkey });
    }
    return result;
  }, [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        ref={listRef}
        data={grouped}
        keyExtractor={(item) => item.msg.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          loading ? <ActivityIndicator size="small" color={c.textMuted} style={{ marginTop: 40 }} />
          : <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 }}>No messages yet</Text>
        }
        renderItem={({ item: { msg, showAvatar } }) => (
          <View style={[styles.msgRow, showAvatar ? styles.msgRowTop : styles.msgRowGrouped]}>
            {showAvatar ? (
              (() => {
                const p = profileMap.get(msg.pubkey);
                if (p?.picture) {
                  return (
                    <TouchableOpacity onPress={() => setViewProfilePubkey(msg.pubkey)}>
                      <Image source={{ uri: p.picture }} style={styles.avatar} contentFit="cover" />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity onPress={() => setViewProfilePubkey(msg.pubkey)}>
                    <View style={[styles.avatar, { backgroundColor: c.bgCard }]}>
                      <Text style={[styles.avatarText, { color: c.textMuted }]}>
                        {msg.pubkey.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()
            ) : (
              <View style={{ width: 40, marginHorizontal: 8 }} />
            )}
            <View style={styles.content}>
              {showAvatar && (
                <View style={styles.header}>
                  <Text style={[styles.author, { color: c.text }]}>
                    {msg.pubkey === userPubkey
                      ? (profile?.display_name || profile?.name || 'You')
                      : ((profileMap.get(msg.pubkey)?.display_name || profileMap.get(msg.pubkey)?.name) || msg.pubkey.slice(0, 12) + '...')}
                  </Text>
                  <Text style={[styles.time, { color: c.textMuted }]}>{formatTimestamp(msg.created_at)}</Text>
                </View>
              )}
              <Text style={[styles.body, { color: c.text }]}>{msg.content}</Text>
            </View>
          </View>
        )}
      />
      <View style={[styles.composer, { backgroundColor: c.bg, borderTopColor: c.borderLight, paddingBottom: insets.bottom + 10, marginBottom: keyboardH }]}>
        <TextInput
          style={[styles.input, { backgroundColor: c.bgInput, color: c.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={c.textMuted}
          multiline
        />
        <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.bg, fontWeight: '600', fontSize: 15 }}>Send</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!viewProfilePubkey} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setViewProfilePubkey(null)} />
          <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, { transform: [{ translateY: profileDrag.panY }] }]}>
          <View style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', backgroundColor: c.bg, maxHeight: '90%' }}>
            {(() => {
              const pk = viewProfilePubkey;
              const isOwn = pk === userPubkey;
              const p = isOwn ? profile : profileMap.get(pk || '');
              return (
                <>
                  <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }} {...profileDrag.panHandlers}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  </View>
                  <ScrollView bounces={true} style={{ maxHeight: 500 }}>
                    <View style={{ height: 140, backgroundColor: c.bgCard }}>
                      {p?.banner && <Image source={{ uri: p.banner }} style={{ width: '100%', height: '100%' }} />}
                    </View>
                    <View style={{ alignItems: 'center', marginTop: -44 }}>
                      <View style={{ padding: 4, borderRadius: 44, backgroundColor: c.bg }}>
                        {p?.picture ? <Image source={{ uri: p.picture }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                        : <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.bgCard, justifyContent: 'center', alignItems: 'center' }}>
                            <UserCircle size={44} color={c.textMuted} weight="fill" />
                          </View>}
                      </View>
                    </View>
                    <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>
                        {p?.display_name || p?.name || pk?.slice(0, 12) || ''}
                      </Text>
                      {p?.pronouns && <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{p.pronouns}</Text>}
                      {p?.about && (
                        <View style={{ backgroundColor: c.bgCard, borderRadius: 12, padding: 14, marginTop: 16 }}>
                          <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>About Me</Text>
                          <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{p.about}</Text>
                        </View>
                      )}
                      {p?.website && (
                        <View style={{ backgroundColor: c.bgCard, borderRadius: 12, padding: 14, marginTop: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Globe size={16} color={c.textSecondary} />
                            <Text style={{ color: c.accent, fontSize: 14 }}>{p.website}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </>
              );
            })()}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: { flexDirection: 'row', paddingRight: 16 },
  msgRowTop: { paddingTop: 4 },
  msgRowGrouped: { paddingTop: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  avatarText: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  author: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 11 },
  body: { fontSize: 15, lineHeight: 20 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
    paddingVertical: 10, borderTopWidth: 1, gap: 8,
  },
  input: { flex: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
});
