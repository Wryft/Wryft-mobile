import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const UPDATE_URL = 'https://wryft.app/version.json';

interface UpdateInfo {
  version: string;
  url: string;
  message?: string;
}

export function useUpdateCheck() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(UPDATE_URL);
        const data: UpdateInfo = await res.json();
        const current = Constants.expoConfig?.version || '1.0.0';
        if (data.version !== current) {
          setUpdate(data);
        }
      } catch {}
    })();
  }, []);

  return update;
}

export function UpdateBanner({ update, onDismiss }: { update: UpdateInfo; onDismiss: () => void }) {
  return (
    <View style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>Update available</Text>
        <Text style={styles.bannerText}>{update.message || `Version ${update.version} is ready`}</Text>
      </View>
      <TouchableOpacity onPress={() => Linking.openURL(update.url)} style={styles.bannerBtn}>
        <Text style={styles.bannerBtnText}>Download</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={{ paddingLeft: 8 }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>x</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  bannerBtn: {
    backgroundColor: '#4ADE80',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
});
