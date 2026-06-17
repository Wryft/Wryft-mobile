import { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
import { SimplePool, type Filter as NostrFilter, type Event, type Relay as NostrRelay } from 'nostr-tools';

type Filter = NostrFilter;

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface RelayContextType {
  relays: string[];
  connected: boolean;
  subscribe: (filter: Filter, opts: {
    onevent: (event: Event) => void;
    oneose?: () => void;
  }) => { close: () => void };
  querySync: (filter: Filter, timeout?: number) => Promise<Event[]>;
  publish: (event: any) => Promise<void>;
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
}

const RelayContext = createContext<RelayContextType | null>(null);

export function RelayProvider({ children }: { children: React.ReactNode }) {
  const poolRef = useRef<SimplePool>(new SimplePool());
  const relaysRef = useRef<string[]>([...DEFAULT_RELAYS]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    return () => {
      poolRef.current.close(relaysRef.current);
    };
  }, []);

  const subscribe = useCallback((
    filter: Filter,
    opts: { onevent: (event: Event) => void; oneose?: () => void },
  ) => {
    // wrap onevent to catch relay errors
    const wrapped: any = { ...opts };
    wrapped.onevent = (event: Event) => {
      try { opts.onevent(event); } catch {}
    };
    let sub: any;
    try {
      sub = poolRef.current.subscribe(relaysRef.current, filter, wrapped);
    } catch {
      // subscription failed, return noop
      return { close: () => {} };
    }
    return { close: () => { try { sub.close(); } catch {} } };
  }, []);

  const querySync = useCallback(async (
    filter: Filter,
    timeout = 2000,
  ): Promise<Event[]> => {
    try {
      const events = await poolRef.current.querySync(relaysRef.current, filter, { maxWait: timeout });
      return events;
    } catch {
      return [];
    }
  }, []);

  const publish = useCallback(async (event: any) => {
    await poolRef.current.publish(relaysRef.current, event);
  }, []);

  const addRelay = useCallback((url: string) => {
    if (!relaysRef.current.includes(url)) {
      relaysRef.current = [...relaysRef.current, url];
    }
  }, []);

  const removeRelay = useCallback((url: string) => {
    relaysRef.current = relaysRef.current.filter(r => r !== url);
  }, []);

  // simple connection check
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!active) return;
      try {
        await poolRef.current.querySync(relaysRef.current.slice(0, 1), { kinds: [1], limit: 1 }, { maxWait: 5000 }).catch(() => {});
        if (active) setConnected(true);
      } catch {
        if (active) setConnected(false);
      }
    };
    setTimeout(check, 500);
    const iv = setInterval(check, 15000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  return (
    <RelayContext.Provider value={{ relays: relaysRef.current, connected, subscribe, querySync, publish, addRelay, removeRelay }}>
      {children}
    </RelayContext.Provider>
  );
}

export function useRelay() {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error('useRelay must be used within RelayProvider');
  return ctx;
}
