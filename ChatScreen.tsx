import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { nip19 } from 'nostr-tools';
import {
  StyleSheet, Text, View, StatusBar,
  FlatList, RefreshControl, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useColors } from './colors';
import { useNostr } from './NostrContext';
import { useDMs } from './useDMs';
import { usePreferences } from './PreferencesContext';
import { useProfiles } from './useProfile';
import { useContactList } from './useContacts';
import { useRelay } from './RelayContext';

const LOADING_GIF = require('./assets/loading.gif');

function formatRelativeTime(seconds: number): string {
  const diff = Date.now() / 1000 - seconds;
  if (diff < 60) return 'Now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`;
  return `${Math.floor(diff / 31536000)}y`;
}

function ConvoAvatar({ pubkey, profile, bgColor, textMuted }: { pubkey: string; profile?: any; bgColor: string; textMuted: string }) {
  if (profile?.picture) {
    return (
      <Image
        source={{ uri: profile.picture }}
        style={styles.avatar}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.avatar, { backgroundColor: bgColor }]}>
      <Text style={[styles.avatarText, { color: textMuted }]}>
        {pubkey.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const ConvoRow = React.memo(function ConvoRow({
  item,
  pubkey,
  onPress,
  textColor,
  mutedColor,
  secondaryColor,
  bgCardColor,
  profile,
}: {
  item: any;
  pubkey: string | null;
  onPress: () => void;
  textColor: string;
  mutedColor: string;
  secondaryColor: string;
  bgCardColor: string;
  profile?: any;
}) {
  const name = profile?.display_name || profile?.name || item.pubkey.slice(0, 12) + '...';
  const preview = item.lastContent
    ? `You: ${item.lastContent}`
    : '';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.convoRow}
    >
      <ConvoAvatar pubkey={item.pubkey} profile={profile} bgColor={bgCardColor} textMuted={mutedColor} />
      <View style={styles.convoContent}>
        <View style={styles.convoTop}>
          <Text
            style={[styles.convoName, { color: textColor }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[styles.convoTime, { color: mutedColor }]}>
            {item.lastTime ? formatRelativeTime(item.lastTime) : ''}
          </Text>
        </View>
        {preview ? (
          <Text style={[styles.convoPreview, { color: secondaryColor }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function ChatScreen({ navigation }: any) {
  const c = useColors();
  const { publicKey: userPubkey, privateKeyHex } = useNostr();
  const { contacts } = useContactList(userPubkey);
  const { dmPrivacy } = usePreferences();
  const { connected } = useRelay();
  const contactPubkeys = useMemo(() => contacts.map(c => c.pubkey), [contacts]);
  const { conversations, loading, refresh: refreshDMs } = useDMs(userPubkey, privateKeyHex || undefined, dmPrivacy, contactPubkeys);
  const convoPubkeys = useMemo(() => conversations.map(c => c.pubkey), [conversations]);
  const profileMap = useProfiles(convoPubkeys);
  const [showNewDM, setShowNewDM] = useState(false);
  const [newDMPubkey, setNewDMPubkey] = useState('');
  const [newDMError, setNewDMError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = useRef(false);

  const onRefresh = useCallback(() => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    refreshDMs();
    setTimeout(() => {
      isRefreshing.current = false;
      setRefreshing(false);
    }, 2000);
  }, [refreshDMs]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#4ADE80' : '#F23F42' }} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>Wryft</Text>
          {refreshing && (
            <Image source={LOADING_GIF} style={{ width: 24, height: 24 }} contentFit="contain" />
          )}
        </View>
      ),
    });
  }, [navigation, refreshing, c.text, c.bg]);

  const handleStartNewDM = () => {
    const trimmed = newDMPubkey.trim();
    setNewDMError('');
    if (!trimmed) { setNewDMError('Enter a pubkey or npub'); return; }

    let targetPubkey = trimmed;
    if (trimmed.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded.type === 'npub') targetPubkey = decoded.data as string;
        else { setNewDMError('Invalid npub'); return; }
      } catch { setNewDMError('Invalid npub'); return; }
    } else if (!/^[0-9a-f]{64}$/i.test(trimmed)) {
      setNewDMError('Invalid pubkey (must be 64 hex chars or npub)');
      return;
    }

    if (targetPubkey === userPubkey) {
      setNewDMError("Can't DM yourself");
      return;
    }

    setShowNewDM(false);
    setNewDMPubkey('');
    navigation.navigate('ChatDetail', { pubkey: targetPubkey });
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} backgroundColor={c.bg} />
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.pubkey}
        ListHeaderComponent={
          <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>DIRECT MESSAGES</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
        renderItem={({ item }) => (
          <ConvoRow
            item={item}
            pubkey={userPubkey}
            textColor={c.text}
            mutedColor={c.textMuted}
            secondaryColor={c.textSecondary}
            bgCardColor={c.bgCard}
            profile={profileMap.get(item.pubkey)}
            onPress={() => navigation.navigate('ChatDetail', { pubkey: item.pubkey })}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <Text style={[styles.empty, { color: c.textMuted }]}>No messages yet</Text>
          )
        }
      />

      <TouchableOpacity
        onPress={() => setShowNewDM(true)}
        style={[styles.fab, { backgroundColor: c.accent }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.fabText, { color: c.bg }]}>+</Text>
      </TouchableOpacity>

      <Modal visible={showNewDM} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.bgCard }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>New Message</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
              placeholder="npub1... or hex pubkey"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={newDMPubkey}
              onChangeText={(t) => { setNewDMPubkey(t); setNewDMError(''); }}
            />
            {newDMError ? <Text style={styles.modalError}>{newDMError}</Text> : null}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setShowNewDM(false); setNewDMPubkey(''); setNewDMError(''); }} style={styles.modalButton}>
                <Text style={{ color: c.textSecondary, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleStartNewDM} style={[styles.modalButton, { backgroundColor: c.accent }]}>
                <Text style={{ color: c.bg, fontSize: 15, fontWeight: '600' }}>Start DM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600',
  },
  convoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  convoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoName: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  convoTime: {
    fontSize: 11,
    marginLeft: 8,
    opacity: 0.85,
  },
  convoPreview: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
    lineHeight: 14,
    opacity: 0.85,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 4,
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 26,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 14,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalError: {
    color: '#F23F42',
    fontSize: 13,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
