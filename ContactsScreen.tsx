import { StyleSheet, Text, View, FlatList, Image } from 'react-native';
import { useNostr } from './NostrContext';
import { useContactList } from './useContacts';
import { useProfile } from './useProfile';
import { useColors } from './colors';

function ContactRow({ pubkey }: { pubkey: string }) {
  const c = useColors();
  const profile = useProfile(pubkey);
  const name = profile?.display_name || profile?.name || pubkey.slice(0, 12) + '...';
  const picture = profile?.picture;

  return (
    <View style={[styles.row, { borderBottomColor: c.borderLight }]}>
      {picture ? (
        <Image source={{ uri: picture }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: c.bgCard }]}>
          <Text style={[styles.avatarText, { color: c.textMuted }]}>{name[0].toUpperCase()}</Text>
        </View>
      )}
      <Text style={[styles.name, { color: c.text }]}>{name}</Text>
    </View>
  );
}

export default function ContactsScreen() {
  const c = useColors();
  const { publicKey } = useNostr();
  const { contacts, loading } = useContactList(publicKey);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={contacts}
        renderItem={({ item }) => <ContactRow pubkey={item.pubkey} />}
        keyExtractor={(item) => item.pubkey}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? null : (
            <Text style={[styles.empty, { color: c.textMuted }]}>No contacts found</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 14,
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
});
