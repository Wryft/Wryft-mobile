import { useState, useEffect } from 'react';
import { useRelay } from './RelayContext';

export interface ProfileData {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  pronouns?: string;
}

const cache = new Map<string, ProfileData>();

async function queryWithRetry(
  querySync: (filter: any, timeout?: number) => Promise<any[]>,
  filter: any,
  retries = 3,
  delay = 1000,
): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      return await querySync(filter);
    } catch (e: any) {
      if (e?.message?.includes?.('not acceptable') && i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  return [];
}

export function useProfile(pubkey: string | undefined) {
  const { querySync } = useRelay();
  const [profile, setProfile] = useState<ProfileData | null>(pubkey ? cache.get(pubkey) || null : null);

  useEffect(() => {
    if (!pubkey || cache.has(pubkey)) return;
    (async () => {
      try {
        const events = await queryWithRetry(querySync, { kinds: [0], authors: [pubkey], limit: 1 });
        if (events.length > 0) {
          const data = JSON.parse(events[0].content);
          cache.set(pubkey, data);
          setProfile(data);
        }
      } catch {}
    })();
  }, [pubkey, querySync]);

  return profile;
}

export function useProfiles(pubkeys: string[]) {
  const { querySync } = useRelay();
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(() => {
    const m = new Map();
    for (const pk of pubkeys) {
      if (cache.has(pk)) m.set(pk, cache.get(pk));
    }
    return m;
  });

  useEffect(() => {
    const uncached = pubkeys.filter(pk => !cache.has(pk));
    if (uncached.length === 0) return;
    (async () => {
      try {
        const events = await queryWithRetry(querySync, { kinds: [0], authors: uncached, limit: uncached.length });
        const m = new Map(profiles);
        for (const ev of events) {
          try {
            const data = JSON.parse(ev.content);
            cache.set(ev.pubkey, data);
            m.set(ev.pubkey, data);
          } catch {}
        }
        setProfiles(new Map(m));
      } catch {}
    })();
  }, [pubkeys.join(',')]);

  return profiles;
}
