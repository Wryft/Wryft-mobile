import { useState, useEffect, useCallback, useRef } from 'react';
import { nip04, finalizeEvent } from 'nostr-tools';
import { useRelay } from './RelayContext';

export interface DM {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
}

export interface Conversation {
  pubkey: string;
  messages: DM[];
  lastTime: number;
  lastContent: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function getOtherPubkey(ev: DM, myPubkey: string): string | undefined {
  if (ev.pubkey === myPubkey) {
    const pTag = ev.tags.find((t: string[]) => t[0] === 'p');
    return pTag?.[1];
  }
  return ev.pubkey;
}

const decryptCache = new Map<string, string>();

export function useDMs(pubkey: string | undefined, privateKeyHex: string | undefined, dmPrivacy?: string, contactPubkeys?: string[]) {
  const { subscribe } = useRelay();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const batch = useRef<DM[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubkeyRef = useRef(pubkey);
  pubkeyRef.current = pubkey;

  const flush = useCallback(() => {
    if (batch.current.length === 0) return;
    const events = batch.current;
    batch.current = [];
    const pk = pubkeyRef.current;
    if (!pk) return;
    setConversations(prev => {
      const seen = new Set<string>();
      for (const e of prev.flatMap(c => c.messages)) seen.add(e.id);
      const all = [...prev.flatMap(c => c.messages), ...events.filter(e => !seen.has(e.id))];
      const map = new Map<string, DM[]>();
      for (const ev of all) {
        const other = getOtherPubkey(ev, pk);
        if (!other) continue;
        const list = map.get(other) || [];
        list.push(ev);
        map.set(other, list);
      }
      const convs: Conversation[] = [];
      for (const [k, msgs] of map) {
        msgs.sort((a, b) => a.created_at - b.created_at);
        convs.push({ pubkey: k, messages: msgs, lastTime: msgs[msgs.length - 1].created_at, lastContent: msgs[msgs.length - 1].content });
      }
      convs.sort((a, b) => b.lastTime - a.lastTime);
      return convs;
    });
  }, []);

  const queueDecrypted = useCallback((dm: DM) => {
    batch.current.push(dm);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 100);
  }, [flush]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setConversations([]);
    setLoading(true);
  }, []);

  const contactSetRef = useRef(new Set(contactPubkeys || []));
  contactSetRef.current = new Set(contactPubkeys || []);
  const privacyRef = useRef(dmPrivacy);
  privacyRef.current = dmPrivacy;

  useEffect(() => {
    if (!pubkey) return;

    // reset conversations when pubkey changes
    setConversations([]);
    setLoading(true);

    const seen = new Set<string>();
    let loadingDone = false;

    const decrypt = async (event: any) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);

      const cached = decryptCache.get(event.id);
      if (cached) {
        const other = getOtherPubkey(event, pubkey);
        if (!other) return;
      if (event.pubkey !== pubkey) {
        const p = privacyRef.current;
        if (p === 'none') return;
        if (p === 'contacts' && !contactSetRef.current.has(other)) return;
      }
        queueDecrypted({ id: event.id, pubkey: event.pubkey, content: cached, created_at: event.created_at, tags: event.tags });
        return;
      }

      const otherPubkey = event.pubkey === pubkey
        ? event.tags.find((t: string[]) => t[0] === 'p')?.[1]
        : event.pubkey;
      if (!otherPubkey) return;
      if (event.pubkey !== pubkey) {
        const p = privacyRef.current;
        if (p === 'none') return;
        if (p === 'contacts' && !contactSetRef.current.has(otherPubkey)) return;
      }

      try {
        const content = privateKeyHex ? await nip04.decrypt(privateKeyHex, otherPubkey, event.content) : '[encrypted]';
        decryptCache.set(event.id, content);
        queueDecrypted({ id: event.id, pubkey: event.pubkey, content, created_at: event.created_at, tags: event.tags });
      } catch {}
    };

    const sub1 = subscribe(
      { kinds: [4], '#p': [pubkey], limit: 15 },
      { onevent: decrypt, oneose: () => { if (!loadingDone) { loadingDone = true; setLoading(false); } } },
    );
    const sub2 = subscribe(
      { kinds: [4], authors: [pubkey], limit: 15 },
      { onevent: decrypt, oneose: () => { if (!loadingDone) { loadingDone = true; setLoading(false); } } },
    );

    return () => { sub1.close(); sub2.close(); if (timer.current) clearTimeout(timer.current); };
  }, [pubkey, privateKeyHex, subscribe, refreshKey]);

  return { conversations, loading, refresh };
}

export async function sendDM(privateKeyHex: string, recipientPubkey: string, content: string, publishFn: (event: any) => Promise<void>) {
  const encrypted = await nip04.encrypt(privateKeyHex, recipientPubkey, content);
  const event = finalizeEvent(
    { kind: 4, content: encrypted, tags: [['p', recipientPubkey]], created_at: Math.floor(Date.now() / 1000) },
    hexToBytes(privateKeyHex),
  );
  await publishFn(event);
}
