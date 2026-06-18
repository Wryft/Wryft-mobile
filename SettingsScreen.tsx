import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  PaintBrush,
  Lock,
  PlugsConnected,
  SignOut,
  CaretRight,
  CaretLeft,
  UserCircle,
  Camera,
  Key,
  Info,
} from 'phosphor-react-native';
import { nip19, finalizeEvent } from 'nostr-tools';
import { useNostr } from './NostrContext';
import { usePreferences } from './PreferencesContext';
import { useRelay } from './RelayContext';
import { useColors } from './colors';
import { uploadImage } from './uploadImage';

type Section = 'profile' | 'lookAndFeel' | 'privacy' | 'relays' | 'keys' | 'about';

interface NavItem {
  section: Section;
  icon: any;
  label: string;
  isDanger?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: 'USER SETTINGS',
    items: [
      { section: 'profile', icon: User, label: 'Profile' },
      { section: 'lookAndFeel', icon: PaintBrush, label: 'Look & Feel' },
      { section: 'privacy', icon: Lock, label: 'Privacy' },
    ],
  },
  {
    label: 'ADVANCED',
    items: [
      { section: 'relays', icon: PlugsConnected, label: 'Relays' },
      { section: 'keys', icon: Key, label: 'Keys' },
    ],
  },
  {
    label: 'ABOUT',
    items: [
      { section: 'about', icon: Info, label: 'About' },
    ],
  },
  {
    items: [
      { section: 'profile', icon: SignOut, label: 'Log Out', isDanger: true },
    ],
  },
];

function NavItemRow({ item, onPress }: { item: NavItem; onPress: () => void }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.7,
      duration: 50,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const handlePressOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const color = item.isDanger ? '#F23F42' : c.text;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.menuRow, { opacity }]}>
        <View style={styles.menuIconBox}>
          <item.icon size={20} color={color} weight="fill" />
        </View>
        <Text style={[styles.menuLabel, { color }]}>{item.label}</Text>
        <CaretRight size={18} color={c.textMuted} weight="bold" />
      </Animated.View>
    </Pressable>
  );
}

function SectionLabel({ label }: { label: string }) {
  const c = useColors();
  return <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{label}</Text>;
}

function GroupSeparator() {
  return <View style={styles.groupSeparator} />;
}

function UserHeader() {
  const c = useColors();
  const { profile, npub } = useNostr();
  const displayName = profile?.display_name || profile?.name || npub.slice(0, 12) + '...';
  const picture = profile?.picture;
  return (
    <View style={[styles.userHeader, { borderBottomColor: c.borderLight }]}>
      {picture ? (
        <Image source={{ uri: picture }} style={styles.userAvatarSmallImg} />
      ) : (
        <View style={[styles.userAvatarSmall, { backgroundColor: c.bgCard }]}>
          <UserCircle size={32} color={c.textMuted} weight="fill" />
        </View>
      )}
      <Text style={[styles.userName, { color: c.text }]}>{displayName}</Text>
    </View>
  );
}

function SettingsNav({ onSelect, onLogout }: { onSelect: (section: Section) => void; onLogout: () => void }) {
  const data: (NavItem | string)[] = [];
  groups.forEach((group, gi) => {
    if (gi > 0) data.push('__separator__');
    if (group.label) data.push(group.label);
    group.items.forEach((item) => data.push(item));
  });

  return (
    <FlatList
      data={data}
      ListHeaderComponent={<UserHeader />}
      renderItem={({ item }) => {
        if (item === '__separator__') return <GroupSeparator />;
        if (typeof item === 'string') return <SectionLabel label={item} />;
        return (
          <NavItemRow
            item={item}
            onPress={() => {
              if (item.isDanger && item.label === 'Log Out') {
                onLogout();
              } else {
                onSelect(item.section);
              }
            }}
          />
        );
      }}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.listContent}
    />
  );
}

const _kMaxDisplayNameLength = 32;
const _kMaxPronounsLength = 40;
const _kMaxBioLength = 320;

function ProfilePage() {
  const c = useColors();
  const { profile, npub, nsec, privateKeyHex, refreshProfile } = useNostr();
  const { publish } = useRelay();
  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [bio, setBio] = useState('');
  const [nip05, setNip05] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const displayNameLabel = profile?.display_name || profile?.name || npub;
  const canSave = !!privateKeyHex;

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.name || '');
      setPronouns(profile.pronouns || '');
      setBio(profile.about || '');
      setAvatarUrl(profile.picture || null);
      setNip05(profile.nip05 || '');
    }
  }, [profile]);
  const picture = avatarUrl || profile?.picture;

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    const ext = (result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg');
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    const url = await uploadImage(result.assets[0].uri, mime, privateKeyHex || undefined);
    if (url) setAvatarUrl(url);
    setAvatarUploading(false);
  };

  const handleSave = async () => {
    if (!privateKeyHex || !nsec) return;
    setSaving(true);
    setSaved(false);
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type !== 'nsec') return;
      const sk = decoded.data as Uint8Array;

      const existing: Record<string, string> = {};
      if (profile?.name) existing.name = profile.name;
      if (profile?.banner) existing.banner = profile.banner;
      if (profile?.nip05) existing.nip05 = profile.nip05;
      if (profile?.lud16) existing.lud16 = profile.lud16;
      if (profile?.website) existing.website = profile.website;

      const metadata = {
        ...existing,
        display_name: displayName,
        name: displayName || profile?.name || '',
        picture: avatarUrl || profile?.picture || '',
        pronouns,
        about: bio,
        nip05: nip05 || existing.nip05 || '',
      };

      const eventTemplate = {
        kind: 0,
        content: JSON.stringify(metadata),
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      };

      const signed = finalizeEvent(eventTemplate, sk);
      await publish(signed);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setTimeout(refreshProfile, 2000);
    } catch (e) {
      console.error('save profile failed', e);
    }
    setSaving(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <View style={[styles.profileHeader, { borderBottomColor: c.borderLight }]}>
        {picture ? (
          <Image source={{ uri: picture }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: c.bgCard }]}>
            <UserCircle size={48} color={c.textMuted} weight="fill" />
          </View>
        )}
        <Text style={[styles.profileUsername, { color: c.text }]}>{displayNameLabel}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>PUBLIC KEY</Text>
        <Text style={[styles.usernameText, { color: c.text }]} selectable>{npub}</Text>
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>Share this to receive messages</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>DISPLAY NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display Name"
          placeholderTextColor={c.textMuted}
          maxLength={_kMaxDisplayNameLength}
        />
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>
          {_kMaxDisplayNameLength - displayName.length} characters remaining
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>PRONOUNS</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
          value={pronouns}
          onChangeText={setPronouns}
          placeholder="they/them"
          placeholderTextColor={c.textMuted}
          maxLength={_kMaxPronounsLength}
        />
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>
          {_kMaxPronounsLength - pronouns.length} characters remaining
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NIP-05</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
          value={nip05}
          onChangeText={setNip05}
          placeholder="you@example.com"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>
          Nostr address for verified checkmark. Host a .well-known/nostr.json on your domain with your pubkey.
        </Text>
        <Text style={[styles.fieldHint, { color: c.textMuted, marginTop: 4 }]}>
          Example: name@example.com → https://example.com/.well-known/nostr.json?name=name
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>AVATAR</Text>
        {picture && (
          <Image source={{ uri: picture }} style={styles.currentAvatar} />
        )}
        <TouchableOpacity
          onPress={handlePickAvatar}
          disabled={avatarUploading}
          style={[styles.actionButton, { backgroundColor: c.bgCard, opacity: avatarUploading ? 0.6 : 1 }]}
        >
          <Camera size={16} color={c.text} weight="fill" />
          <Text style={[styles.actionButtonText, { color: c.text }]}>
            {avatarUploading ? 'Uploading...' : 'Change Avatar'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>Recommended size: 512x512px</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>ABOUT ME</Text>
        <TextInput
          style={[styles.input, styles.bioInput, { backgroundColor: c.bgInput, color: c.text, borderColor: c.border }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself..."
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={_kMaxBioLength}
          textAlignVertical="top"
        />
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>
          {_kMaxBioLength - bio.length} characters remaining
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        {canSave ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: c.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={[styles.saveButtonText, { color: c.bg }]}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.fieldHint, { color: c.textMuted, textAlign: 'center' }]}>
            Login with nsec to save profile changes
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const _chatFontSizeMarkers = [12, 14, 15, 16, 18, 20, 24];

const swatchColors: Record<string, string> = {
  coal: '#000',
  light: '#fff',
};

function LookAndFeelPage() {
  const c = useColors();
  const prefs = usePreferences();
  const [slidingSize, setSlidingSize] = useState(prefs.chatFontSize);

  const themeSwatches = ['coal', 'light'] as const;

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>THEME</Text>
        <View style={styles.swatchRow}>
          {themeSwatches.map((mode) => {
            const selected = prefs.theme === mode;
            const swatchLabel = mode === 'coal' ? 'Coal' : 'Light';
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => prefs.setTheme(mode)}
                style={[
                  styles.swatchButton,
                  { borderColor: c.border },
                  selected && { borderColor: c.accent },
                ]}
              >
                <View style={[styles.swatchCircle, { backgroundColor: swatchColors[mode], borderColor: c.border }]} />
                <Text style={[styles.swatchLabel, { color: c.textSecondary }, selected && { color: c.text }]}>
                  {swatchLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>CHAT FONT SIZE</Text>
        <View style={[styles.fontPreview, { backgroundColor: c.bgCard }]}>
          <Text style={[styles.fontPreviewText, { color: c.text, fontSize: slidingSize }]}>
            The quick brown fox jumps over the lazy dog.
          </Text>
        </View>
        <View style={styles.sliderContainer}>
          {_chatFontSizeMarkers.map((size) => (
            <TouchableOpacity
              key={size}
              onPress={() => { prefs.setChatFontSize(size); setSlidingSize(size); }}
              style={[
                styles.sliderMarker,
                prefs.chatFontSize === size && { backgroundColor: c.bgCardAlt },
              ]}
            >
              <Text style={[
                styles.sliderMarkerText,
                { color: c.textMuted },
                prefs.chatFontSize === size && { color: c.text, fontWeight: '600' },
                size === 16 && { color: '#4ADE80' },
              ]}>
                {size}px
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>INTERFACE</Text>
        <View style={[styles.toggleGroup, { backgroundColor: c.bgCard }]}>
          <ToggleRow
            label="Channel typing indicators"
            description="Show when someone is typing in a channel"
            value={prefs.typingIndicators}
            onToggle={prefs.setTypingIndicators}
          />
          <ToggleRow
            label="Hide keyboard hints"
            description="Hide keyboard shortcut hints in the message area"
            value={prefs.hideKeyboardHints}
            onToggle={prefs.setHideKeyboardHints}
          />
          <ToggleRow
            label="Collapse direct messages"
            description="Collapse the DM section in the channel list"
            value={prefs.collapseDMs}
            onToggle={prefs.setCollapseDMs}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function PrivacyPage() {
  const c = useColors();
  const prefs = usePreferences();
  const options: { value: 'everyone' | 'contacts' | 'none'; label: string; desc: string }[] = [
    { value: 'everyone', label: 'Everyone', desc: 'Receive DMs from anyone' },
    { value: 'contacts', label: 'Contacts only', desc: 'Only people you have DMed or follow' },
    { value: 'none', label: 'No one', desc: 'Block all incoming DMs' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>DIRECT MESSAGES</Text>
        <View style={[styles.toggleGroup, { backgroundColor: c.bgCard }]}>
          {options.map((opt) => {
            const selected = prefs.dmPrivacy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.toggleRow, { borderBottomColor: c.borderLight }]}
                onPress={() => prefs.setDmPrivacy(opt.value)}
                activeOpacity={0.7}
              >
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleLabel, { color: c.text }]}>{opt.label}</Text>
                  <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>{opt.desc}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: selected ? c.accent : c.textTertiary }]}>
                  {selected && <View style={[styles.radioInner, { backgroundColor: c.accent }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function ToggleRow({ label, description, value, onToggle }: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <TouchableOpacity
      style={[styles.toggleRow, { borderBottomColor: c.borderLight }]}
      onPress={() => onToggle(!value)}
      activeOpacity={0.7}
    >
      <View style={styles.toggleInfo}>
        <Text style={[styles.toggleLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>{description}</Text>
      </View>
      <View style={[styles.toggleTrack, { backgroundColor: c.textTertiary }, value && { backgroundColor: c.accent }]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

function RelaysPage() {
  const c = useColors();
  const { relays, addRelay, removeRelay, connected } = useRelay();
  const [newRelay, setNewRelay] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardH, setKeyboardH] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardH(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleAdd = () => {
    const url = newRelay.trim();
    if (!url) return;
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      return;
    }
    addRelay(url);
    setNewRelay('');
  };

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sectionContent}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>CONNECTION</Text>
        <View style={[styles.toggleGroup, { backgroundColor: c.bgCard }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={[styles.toggleLabel, { color: c.text }]}>Status</Text>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#4ADE80' : '#F23F42' }} />
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>{connected ? 'Connected' : 'Disconnected'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>RELAYS</Text>
        <View style={[styles.toggleGroup, { backgroundColor: c.bgCard }]}>
          {relays.map((relay) => (
            <View key={relay} style={[styles.toggleRow, { borderBottomColor: c.borderLight }]}>
              <Text style={[styles.toggleLabel, { color: c.text, fontSize: 13, flex: 1 }]} numberOfLines={1}>
                {relay}
              </Text>
              <TouchableOpacity onPress={() => removeRelay(relay)}>
                <Text style={{ color: '#F23F42', fontSize: 13 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.fieldGroup, { paddingBottom: keyboardH }]}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>ADD RELAY</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: c.bgInput,
              color: c.text,
              borderRadius: 24,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 16,
            }}
            value={newRelay}
            onChangeText={setNewRelay}
            placeholder="wss://relay.example.com"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={handleAdd} style={[styles.saveButton, { backgroundColor: c.accent, paddingHorizontal: 16 }]}>
            <Text style={[styles.saveButtonText, { color: c.bg }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function KeysPage() {
  const c = useColors();
  const { npub, nsec } = useNostr();
  const [showNsec, setShowNsec] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NPUB (PUBLIC KEY)</Text>
        <Text style={[styles.usernameText, { color: c.text }]} selectable>{npub}</Text>
        <Text style={[styles.fieldHint, { color: c.textMuted }]}>Share this freely — it's your public address.</Text>
      </View>

      {nsec ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NSEC (PRIVATE KEY)</Text>
          <View style={[styles.nsecBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 14, fontFamily: 'monospace' }} selectable={showNsec}>
              {showNsec ? nsec : nsec.slice(0, 12) + '••••••••••••••••••••'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowNsec(!showNsec)}
            style={[styles.actionButton, { backgroundColor: c.bgCard, marginTop: 8 }]}
          >
            <Text style={{ color: c.text, fontSize: 14 }}>
              {showNsec ? 'Hide nsec' : 'Reveal nsec'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.fieldHint, { color: '#F23F42', marginTop: 8, fontWeight: '500' }]}>
            Never share your nsec. It gives full access to your account.
          </Text>
        </View>
      ) : (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NSEC (PRIVATE KEY)</Text>
          <Text style={[styles.fieldHint, { color: c.textMuted }]}>
            Not available — you logged in with an npub.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function AboutPage() {
  const c = useColors();
  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={[styles.profileHeader, { borderBottomColor: c.borderLight }]}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Wryft</Text>
        <Text style={{ color: c.textSecondary, fontSize: 14 }}>Version 1.0.0</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>ABOUT</Text>
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>
          Wryft is a private, decentralized chat app built on the Nostr protocol. Messages are encrypted, your identity is yours, and there are no central servers.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>LINKS</Text>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: c.bgCard }]}>
          <Text style={{ color: c.accent, fontSize: 15 }}>GitHub</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: c.bgCard }]}>
          <Text style={{ color: c.accent, fontSize: 15 }}>Website</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>TECHNOLOGY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['React Native', 'Expo', 'Nostr', 'TypeScript'].map(tag => (
            <View key={tag} style={{ backgroundColor: c.bgCard, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsSubPage({
  section,
  onBack,
}: {
  section: Section;
  onBack: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TouchableOpacity onPress={onBack} style={[styles.backRow, { borderBottomColor: c.borderLight, paddingTop: insets.top + 12 }]}>
        <CaretLeft size={20} color={c.text} weight="bold" />
        <Text style={[styles.backLabel, { color: c.text }]}>Settings</Text>
      </TouchableOpacity>
      {section === 'profile' ? (
        <ProfilePage />
      ) : section === 'lookAndFeel' ? (
        <LookAndFeelPage />
      ) : section === 'privacy' ? (
        <PrivacyPage />
      ) : section === 'relays' ? (
        <RelaysPage />
      ) : section === 'keys' ? (
        <KeysPage />
      ) : section === 'about' ? (
        <AboutPage />
      ) : null}
    </View>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useNostr();
  const [currentSection, setCurrentSection] = useState<Section | null>(null);

  const handleLogout = () => {
    logout();
    navigation.replace('Welcome');
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} backgroundColor={c.bg} />
      {currentSection ? (
        <SettingsSubPage
          section={currentSection}
          onBack={() => setCurrentSection(null)}
        />
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <SettingsNav onSelect={(s) => setCurrentSection(s)} onLogout={handleLogout} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  groupSeparator: {
    height: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  menuIconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backLabel: {
    color: '#E0E0E0',
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 8,
  },
  profileContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  currentAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  userAvatarSmallImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  profileUsername: {
    color: '#E0E0E0',
    fontSize: 20,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E0E0E0',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  bioInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  fieldHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 6,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usernameText: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  tagButton: {
    backgroundColor: '#2D2D2D',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagButtonText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D2D2D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  actionButtonText: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '500',
  },
  bannerUpsell: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 16,
  },
  bannerUpsellText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  getPlutoniumButton: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  getPlutoniumText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '600',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    marginBottom: 8,
  },
  userAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userName: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 20,
    paddingBottom: 40,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swatchButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    flex: 1,
  },
  swatchButtonSelected: {
    borderColor: '#E0E0E0',
  },
  swatchCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  swatchLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  swatchLabelSelected: {
    color: '#E0E0E0',
  },
  fontPreview: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  fontPreviewText: {
    color: '#E0E0E0',
    lineHeight: 22,
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderMarker: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  sliderMarkerActive: {
    backgroundColor: '#1A1A2E',
  },
  sliderMarkerText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
  },
  sliderMarkerTextActive: {
    color: '#E0E0E0',
    fontWeight: '600',
  },
  toggleGroup: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: '#E0E0E0',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  nsecBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
