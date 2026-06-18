import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Conversation } from './useDMs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

export async function initNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dms', {
      name: 'Direct Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100],
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function useDMNotifications(
  conversations: Conversation[],
  userPubkey: string | undefined,
  profileMap: Map<string, { display_name?: string; name?: string }>,
) {
  const lastCounts = useRef<Map<string, number>>(new Map());
  const ready = useRef(false);

  useEffect(() => {
    for (const conv of conversations) {
      const prevCount = lastCounts.current.get(conv.pubkey);
      // first time seeing this conversation — just record the count, don't notify
      if (prevCount === undefined) {
        lastCounts.current.set(conv.pubkey, conv.messages.length);
        continue;
      }
      // new messages arrived
      if (conv.messages.length > prevCount) {
        const newMsgs = conv.messages.slice(prevCount);
        for (const msg of newMsgs) {
          if (msg.pubkey !== userPubkey) {
            const profile = profileMap.get(conv.pubkey);
            const sender = profile?.display_name || profile?.name || conv.pubkey.slice(0, 12);
            const preview = msg.content.length > 80
              ? msg.content.slice(0, 80) + '...'
              : msg.content;

            Notifications.scheduleNotificationAsync({
              content: { title: sender, body: preview, data: { pubkey: conv.pubkey } },
              trigger: null,
            }).catch(() => {});
          }
        }
        lastCounts.current.set(conv.pubkey, conv.messages.length);
      }
    }
  }, [conversations, userPubkey, profileMap]);
}
