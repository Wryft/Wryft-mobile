import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Image } from 'expo-image';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  Keyboard, Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from './colors';
import { useNostr } from './NostrContext';
import * as ImagePicker from 'expo-image-picker';
import { nip19, finalizeEvent } from 'nostr-tools';
import { useRelay } from './RelayContext';
import { usePreferences } from './PreferencesContext';
import { uploadImage } from './uploadImage';
import { useProfile } from './useProfile';
import { useContactList } from './useContacts';
import { useDMs, sendDM, type Conversation } from './useDMs';
import { X, CopySimple, UserCircle, Globe } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';

const AVATAR_COLUMN = 56;

function ProfileAvatar({ pubkey, size }: { pubkey: string; size?: number }) {
  const p = useProfile(pubkey);
  const c = useColors();
  const s = size || 40;
  if (p?.picture) {
    return <Image source={{ uri: p.picture }} style={{ width: s, height: s, borderRadius: s / 2 }} contentFit="cover" />;
  }
  return (
    <View style={[styles.msgAvatar, { backgroundColor: c.bgCard, width: s, height: s, borderRadius: s / 2 }]}>
      <Text style={[styles.msgAvatarText, { color: c.textMuted }]}>
        {pubkey.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function findImageUrls(text: string): string[] {
  return text.split('\n').filter(line => {
    const t = line.trim();
    return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i.test(t) ||
           /^https?:\/\/(i\.imgur\.com|telegra\.ph|image\.nostr\.build|media\.nostr\.build)\/\S+$/i.test(t);
  }).map(l => l.trim());
}

function formatTimestamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatDetailScreen({ route, navigation }: any) {
  const { publicKey: userPubkey, privateKeyHex, nsec, npub, profile } = useNostr();
  const { contacts, refresh: refreshContacts } = useContactList(userPubkey);
  const { dmPrivacy } = usePreferences();
  const { conversations } = useDMs(userPubkey, privateKeyHex || undefined, dmPrivacy, contacts.map(c => c.pubkey));
  const { publish } = useRelay();
  const targetPubkey = route.params?.pubkey as string;
  const targetProfile = useProfile(targetPubkey);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [keyboardH, setKeyboardH] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<{ id: string; content: string; created_at: number }[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [contextMsg, setContextMsg] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const isContact = contacts.some(c => c.pubkey === targetPubkey);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardH(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const conversation = useMemo(() => {
    if (!targetPubkey) return null;
    const existing = conversations.find((conv) => conv.pubkey === targetPubkey);
    if (existing) return existing;
    return {
      pubkey: targetPubkey,
      messages: [],
      lastTime: Math.floor(Date.now() / 1000),
      lastContent: '',
    } as Conversation;
  }, [conversations, targetPubkey]);

  // clear optimistic messages once relay confirms them
  useEffect(() => {
    if (!conversation) return;
    const confirmed = new Set(conversation.messages.filter(m => m.pubkey === userPubkey).map(m => m.created_at));
    setOptimisticMsgs(prev => prev.filter(m => !confirmed.has(m.created_at)));
  }, [conversation?.messages.length || 0]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowActions(true)} style={{ paddingRight: 16 }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '600' }}>...</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, c.text]);

  const handleAddContact = async () => {
    if (!nsec) return;
    setShowActions(false);
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type !== 'nsec') return;
      const sk = decoded.data as Uint8Array;

      const newTags: string[][] = [];
      for (const c of contacts) {
        newTags.push(['p', c.pubkey, c.relay || '']);
      }
      newTags.push(['p', targetPubkey, '']);

      const eventTemplate = {
        kind: 3,
        content: '',
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
      };

      const signed = finalizeEvent(eventTemplate, sk);
      await publish(signed);
      setTimeout(refreshContacts, 2000);
    } catch (e) {
      console.error('add contact failed', e);
    }
  };

  const handleAttachImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const ext = (result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg');
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    setPendingImage({ uri: result.assets[0].uri, base64: '', mime });
  };

  const handleSend = async () => {
    if (!privateKeyHex || !conversation) return;
    setUploading(true);
    try {
      let finalText = text.trim();
      if (pendingImage) {
        const url = await uploadImage(pendingImage.uri, pendingImage.mime, privateKeyHex || undefined);
        if (url) finalText += (finalText ? '\n' : '') + url;
        setPendingImage(null);
      }
      if (!finalText) return;
      const oid = 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      setOptimisticMsgs(prev => [...prev, { id: oid, content: finalText, created_at: Math.floor(Date.now() / 1000) }]);
      await sendDM(privateKeyHex, conversation.pubkey, finalText, publish);
      setText('');
    } catch (e) {
      console.error('send failed', e);
    } finally {
      setUploading(false);
    }
  };

  if (!conversation || !privateKeyHex) return null;

  const allMsgs = [
    ...conversation.messages,
    ...optimisticMsgs.map((m) => ({
      id: m.id,
      pubkey: userPubkey,
      content: m.content,
      created_at: m.created_at,
      tags: [],
    })),
  ];

  const grouped: { message: any; showAvatar: boolean }[] = [];
  for (let i = 0; i < allMsgs.length; i++) {
    const msg = allMsgs[i];
    const prev = i > 0 ? allMsgs[i - 1] : null;
    const showAvatar = !prev || prev.pubkey !== msg.pubkey;
    grouped.push({ message: msg, showAvatar });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        ref={listRef}
        data={grouped}
        keyExtractor={(item) => item.message.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: { message: msg, showAvatar } }) => {
          const isMe = msg.pubkey === userPubkey;
          return (
            <View style={[styles.msgRow, showAvatar ? styles.msgRowTop : styles.msgRowGrouped]}>
              <View style={styles.avatarColumn}>
                {showAvatar ? (
                  <ProfileAvatar pubkey={isMe ? userPubkey : msg.pubkey} size={40} />
                ) : null}
              </View>
              <View style={styles.msgContent}>
                  {showAvatar && (
                    <View style={styles.msgHeader}>
                      <TouchableOpacity onPress={() => setViewProfile(isMe ? userPubkey : targetPubkey)}>
                        <Text style={[styles.msgAuthor, { color: c.text }]}>
                          {isMe
                            ? (profile?.display_name || profile?.name || 'You')
                            : (targetProfile?.display_name || targetProfile?.name || msg.pubkey.slice(0, 12) + '...')}
                        </Text>
                      </TouchableOpacity>
                    <Text style={[styles.msgTimestamp, { color: c.textMuted }]}>
                      {formatTimestamp(msg.created_at)}
                    </Text>
                  </View>
                )}
                <TouchableOpacity onLongPress={() => setContextMsg(msg.content)} activeOpacity={1} style={{ flex: 1 }}>
                {msg.content.split('\n').map((line: string, i: number) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (/^https?:\/\//i.test(trimmed)) {
                    return (
                      <TouchableOpacity key={i} onPress={() => setViewingImage(trimmed)}>
                        <Image
                          source={{ uri: trimmed }}
                          style={styles.msgImage}
                          contentFit="contain"
                        />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <Text key={i} style={[styles.msgBody, { color: c.text }]}>
                      {line}
                    </Text>
                  );
                })}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      {pendingImage ? (
        <View style={[styles.previewRow, { backgroundColor: c.bgCard, borderTopColor: c.borderLight }]}>
          <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
          <TouchableOpacity onPress={() => setPendingImage(null)} style={styles.previewCancel}>
            <Text style={{ color: c.textMuted, fontSize: 18 }}>x</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={[styles.composer, { backgroundColor: c.bg, borderTopColor: c.borderLight, paddingBottom: insets.bottom + 10, marginBottom: keyboardH }]}>
        <TouchableOpacity onPress={handleAttachImage} style={styles.attachButton}>
          <Text style={[styles.attachButtonText, { color: c.textMuted }]}>+</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.composerInput, { backgroundColor: c.bgInput, color: c.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={c.textMuted}
          multiline
        />
        <TouchableOpacity onPress={handleSend} disabled={uploading} style={[styles.sendButton, { backgroundColor: c.accent }]}>
          {uploading ? (
            <ActivityIndicator size="small" color={c.bg} />
          ) : (
            <Text style={{ color: c.bg, fontWeight: '600', fontSize: 15 }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showActions} transparent animationType="fade">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={[styles.sheetContent, { backgroundColor: c.bgCard }]}>
            {!isContact && nsec ? (
              <TouchableOpacity onPress={handleAddContact} style={styles.sheetRow}>
                <Text style={{ color: c.text, fontSize: 16 }}>Add to Contacts</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => { setShowActions(false); navigation.goBack(); }} style={styles.sheetRow}>
              <Text style={{ color: '#F23F42', fontSize: 16 }}>Close DM</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!contextMsg} transparent animationType="fade">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setContextMsg(null)}>
          <View style={[styles.sheetContent, { backgroundColor: c.bgCard }]}>
            <TouchableOpacity
              onPress={() => { Clipboard.setStringAsync(contextMsg || ''); setContextMsg(null); }}
              style={styles.sheetRow}
            >
              <CopySimple size={20} color={c.text} />
              <Text style={{ color: c.text, fontSize: 16, marginLeft: 10 }}>Copy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!viewProfile} transparent animationType="fade">
        {(() => {
          const isOwn = viewProfile === userPubkey;
          const p = isOwn ? profile : targetProfile;
          return (
            <TouchableOpacity style={styles.profileOverlay} activeOpacity={1} onPress={() => setViewProfile(null)}>
              <TouchableOpacity activeOpacity={1} style={[styles.profileSheet, { backgroundColor: c.bg }]}>
                <View style={styles.profileBanner}>
                  {p?.banner ? <Image source={{ uri: p.banner }} style={styles.profileBannerImg} /> : null}
                </View>

                <View style={[styles.profileAvatarWrap, { marginTop: -44 }]}>
                  <View style={[styles.profileAvatarBorder, { backgroundColor: c.bg }]}>
                    {p?.picture ? (
                      <Image source={{ uri: p.picture }} style={styles.profileAvatar} />
                    ) : (
                      <View style={[styles.profileAvatar, { backgroundColor: c.bgCard, justifyContent: 'center', alignItems: 'center' }]}>
                        <UserCircle size={44} color={c.textMuted} weight="fill" />
                      </View>
                    )}
                  </View>
                </View>

                <ScrollView bounces={false} style={{ maxHeight: 400 }}>
                  <View style={styles.profileBody}>
                    <Text style={{ color: c.text, fontSize: 24, fontWeight: '700' }}>
                      {p?.display_name || p?.name || (viewProfile || '').slice(0, 12) + '...'}
                    </Text>
                    {p?.pronouns && (
                      <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{p.pronouns}</Text>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Text style={{ color: c.textSecondary, fontSize: 14, fontWeight: '500' }}>
                        {isOwn ? npub : nip19.npubEncode(viewProfile || '')}
                      </Text>
                      {p?.nip05 && <Text style={{ color: c.accent, fontSize: 13 }}>{p.nip05}</Text>}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                      <TouchableOpacity onPress={() => setViewProfile(null)} style={[styles.profileBtn, { backgroundColor: c.bgCard, flex: 1 }]}>
                        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                          {isOwn ? 'Close' : 'Message'}
                        </Text>
                      </TouchableOpacity>
                      {!isOwn && !isContact && nsec && (
                        <TouchableOpacity onPress={() => { handleAddContact(); setViewProfile(null); }} style={[styles.profileBtn, { backgroundColor: c.accent }]}>
                          <Text style={{ color: c.bg, fontSize: 15, fontWeight: '600' }}>Add Contact</Text>
                        </TouchableOpacity>
                      )}
                      {!isOwn && (
                        <TouchableOpacity
                          style={[styles.profileBtn, { backgroundColor: c.bgCard, width: 44 }]}
                          onPress={() => { setViewProfile(null); setShowActions(true); }}
                        >
                          <Text style={{ color: c.text, fontSize: 18 }}>...</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {p?.about && (
                      <View style={[styles.profileCard, { backgroundColor: c.bgCard, marginTop: 16 }]}>
                        <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>About Me</Text>
                        <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{p.about}</Text>
                      </View>
                    )}
                    {p?.website && (
                      <View style={[styles.profileCard, { backgroundColor: c.bgCard, marginTop: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Globe size={16} color={c.textSecondary} />
                          <Text style={{ color: c.accent, fontSize: 14 }}>{p.website}</Text>
                        </View>
                      </View>
                    )}
                    <View style={{ height: 40 }} />
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })()}
      </Modal>

      <Modal visible={!!viewingImage} transparent animationType="fade">
        <View style={styles.imageViewOverlay}>
          <TouchableOpacity onPress={() => setViewingImage(null)} style={styles.imageViewClose}>
            <X color="#fff" size={22} weight="bold" />
          </TouchableOpacity>
          <View style={styles.imageViewTouch}>
            {viewingImage && (
              <Image source={{ uri: viewingImage }} style={styles.imageViewFull} contentFit="contain" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: {
    flexDirection: 'row',
    paddingRight: 16,
  },
  msgRowTop: {
    paddingTop: 4,
  },
  msgRowGrouped: {
    paddingTop: 0,
  },
  avatarColumn: {
    width: AVATAR_COLUMN,
    alignItems: 'center',
  },
  msgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  msgContent: {
    flex: 1,
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  msgAuthor: {
    fontSize: 16,
    fontWeight: '600',
  },
  msgTimestamp: {
    fontSize: 12,
  },
  msgBody: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgImage: {
    width: 240,
    height: 240,
    borderRadius: 8,
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButtonText: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  previewCancel: {
    marginLeft: 8,
    padding: 4,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContent: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sheetRow: {
    paddingVertical: 14,
  },
  imageViewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  imageViewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewTouch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewFull: {
    width: '100%',
    height: '100%',
  },
  profileOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  profileSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profileBanner: {
    height: 184,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  profileBannerImg: {
    width: '100%',
    height: '100%',
  },
  profileAvatarWrap: {
    alignItems: 'center',
  },
  profileAvatarBorder: {
    padding: 4,
    borderRadius: 44,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 12,
    padding: 14,
  },
  profileBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
