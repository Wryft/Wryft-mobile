import { useState, useEffect, useCallback } from 'react';
import { useRelay } from './RelayContext';

export interface Contact {
  pubkey: string;
  relay?: string;
}

export function useContactList(pubkey: string | undefined) {
  const { querySync } = useRelay();
  const [contactPubkeys, setContactPubkeys] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!pubkey) return;
    setLoading(true);
    const events = await querySync({ kinds: [3], authors: [pubkey], limit: 1 });
    if (events.length > 0) {
      const tags = events[0].tags;
      const contacts: Contact[] = [];
      for (const tag of tags) {
        if (tag[0] === 'p') {
          contacts.push({ pubkey: tag[1], relay: tag[2] });
        }
      }
      setContactPubkeys(contacts);
    }
    setLoading(false);
  }, [pubkey, querySync]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { contacts: contactPubkeys, loading, refresh: fetch };
}
