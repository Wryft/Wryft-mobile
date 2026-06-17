import { useState, useEffect, useRef } from 'react';
import { useRelay } from './RelayContext';
import { finalizeEvent } from 'nostr-tools';

export interface GroupChannel {
  id: string;
  name: string;
  about?: string;
  picture?: string;
  created_at: number;
  creator: string;
  members: string[];
}

export interface GroupMessage {
  id: string;
  content: string;
  pubkey: string;
  created_at: number;
}

export function useGroupChannels(pubkey: string | undefined) {
  const { subscribe } = useRelay();
  const [channels, setChannels] = useState<GroupChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pubkey) return;

    const seen = new Set<string>();

    const sub = subscribe(
      { kinds: [40, 41], '#p': [pubkey], limit: 50 },
      {
        onevent: (event: any) => {
          if (seen.has(event.id)) return;
          seen.add(event.id);

          if (event.kind === 40) {
            const memberTags = event.tags.filter((t: string[]) => t[0] === 'p');
            const members = memberTags.map((t: string[]) => t[1]);
            const ch: GroupChannel = {
              id: event.id,
              name: 'Unnamed Group',
              created_at: event.created_at,
              creator: event.pubkey,
              members: [event.pubkey, ...members.filter((m: string) => m !== event.pubkey)],
            };
            try {
              const c = JSON.parse(event.content);
              ch.name = c.name || ch.name;
              ch.about = c.about;
              ch.picture = c.picture;
            } catch {}
            setChannels(prev => {
              const idx = prev.findIndex(x => x.id === event.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = ch;
                return next;
              }
              return [...prev, ch];
            });
          }
        },
        oneose: () => setLoading(false),
      },
    );

    return () => sub.close();
  }, [pubkey, subscribe]);

  return { channels: channels.sort((a, b) => b.created_at - a.created_at), loading };
}

export function useGroupMessages(channelId: string | undefined) {
  const { subscribe } = useRelay();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) return;
    setMessages([]);
    setLoading(true);

    const sub = subscribe(
      { kinds: [42], '#e': [channelId], limit: 50 },
      {
        onevent: (event: any) => {
          const msg: GroupMessage = { id: event.id, content: event.content, pubkey: event.pubkey, created_at: event.created_at };
          setMessages(prev => {
            if (prev.some(m => m.id === event.id)) return prev;
            return [...prev, msg].sort((a, b) => a.created_at - b.created_at);
          });
        },
        oneose: () => setLoading(false),
      },
    );

    return () => sub.close();
  }, [channelId, subscribe]);

  return { messages, loading };
}

export async function createPrivateGroup(
  name: string,
  about: string | undefined,
  memberPubkeys: string[],
  skBytes: Uint8Array,
  publishFn: (event: any) => Promise<void>,
) {
  const pTags = memberPubkeys.filter(p => p).map(p => ['p', p]);
  const event = finalizeEvent(
    { kind: 40, content: JSON.stringify({ name, about }), created_at: Math.floor(Date.now() / 1000), tags: pTags },
    skBytes,
  );
  await publishFn(event);
  return event.id;
}

export async function sendPrivateGroupMessage(
  channelId: string,
  content: string,
  memberPubkeys: string[],
  skBytes: Uint8Array,
  publishFn: (event: any) => Promise<void>,
) {
  const pTags = memberPubkeys.filter(p => p).map(p => ['p', p]);
  const event = finalizeEvent(
    { kind: 42, content, created_at: Math.floor(Date.now() / 1000), tags: [['e', channelId], ...pTags] },
    skBytes,
  );
  await publishFn(event);
}
