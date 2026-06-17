import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import * as SecureStore from 'expo-secure-store';
import { useProfile, type ProfileData } from './useProfile';

const STORAGE_KEY_NSEC = 'wryft_nsec';
const STORAGE_KEY_NPUB = 'wryft_npub';

function skBytesToHex(sk: Uint8Array): string {
  return Array.from(sk).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface NostrState {
  privateKeyHex: string | null;
  publicKey: string;
  npub: string;
  nsec: string | null;
  isAuthenticated: boolean;
  loaded: boolean;
  profile: ProfileData | null;
  profileLoading: boolean;
}

interface NostrContextType extends NostrState {
  createAccount: () => void;
  loginWithNsec: (nsec: string) => boolean;
  loginWithNpub: (npub: string) => boolean;
  logout: () => void;
  refreshProfile: () => void;
}

const NostrContext = createContext<NostrContextType | null>(null);

function decodeNsec(key: string): Uint8Array | null {
  try {
    const decoded = nip19.decode(key);
    if (decoded.type === 'nsec') return decoded.data as Uint8Array;
    return null;
  } catch {
    return null;
  }
}

function decodeNpub(key: string): string | null {
  try {
    const decoded = nip19.decode(key);
    if (decoded.type === 'npub') return decoded.data as string;
    return null;
  } catch {
    return null;
  }
}

function NostrInner({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [privateKeyHex, setPrivateKeyHex] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [npub, setNpub] = useState<string>('');
  const [nsec, setNsec] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => !!publicKey, [publicKey]);
  const profile = useProfile(isAuthenticated ? publicKey : undefined);
  const [profileLoading, setProfileLoading] = useState(false);
  const refreshProfile = useCallback(() => {
    setProfileLoading(true);
    // force re-fetch by clearing cache - handled by useProfile
    setTimeout(() => setProfileLoading(false), 2000);
  }, []);

  // Restore stored keys on mount
  useEffect(() => {
    (async () => {
      try {
        const storedNsec = await SecureStore.getItemAsync(STORAGE_KEY_NSEC);
        const storedNpub = await SecureStore.getItemAsync(STORAGE_KEY_NPUB);
        if (storedNsec) {
          loginWithNsecRestore(storedNsec);
        } else if (storedNpub) {
          loginWithNpubRestore(storedNpub);
        }
      } catch {
        // SecureStore unavailable or no stored keys
      }
      setLoaded(true);
    })();
  }, []);

  // Avoid recreating these on every render
  const setKeysFromSk = useCallback((sk: Uint8Array) => {
    const pk = getPublicKey(sk);
    setPrivateKeyHex(skBytesToHex(sk));
    setPublicKey(pk);
    setNpub(nip19.npubEncode(pk));
    setNsec(nip19.nsecEncode(sk));
  }, []);

  const setKeysFromPk = useCallback((pk: string) => {
    setPrivateKeyHex(null);
    setPublicKey(pk);
    setNpub(nip19.npubEncode(pk));
    setNsec(null);
  }, []);

  // Restore functions used only on mount
  const loginWithNsecRestore = useCallback((key: string) => {
    const sk = decodeNsec(key);
    if (!sk) return;
    setKeysFromSk(sk);
  }, [setKeysFromSk]);

  const loginWithNpubRestore = useCallback((key: string) => {
    const pk = decodeNpub(key);
    if (!pk) return;
    setKeysFromPk(pk);
  }, [setKeysFromPk]);

  const createAccount = useCallback(() => {
    const sk = generateSecretKey();
    setKeysFromSk(sk);
    const nsecStr = nip19.nsecEncode(sk);
    const npubStr = nip19.npubEncode(getPublicKey(sk));
    SecureStore.setItemAsync(STORAGE_KEY_NSEC, nsecStr);
    SecureStore.setItemAsync(STORAGE_KEY_NPUB, npubStr);
  }, [setKeysFromSk]);

  const loginWithNsec = useCallback((key: string): boolean => {
    const sk = decodeNsec(key);
    if (!sk) return false;
    setKeysFromSk(sk);
    SecureStore.setItemAsync(STORAGE_KEY_NSEC, key);
    SecureStore.setItemAsync(STORAGE_KEY_NPUB, nip19.npubEncode(getPublicKey(sk)));
    return true;
  }, [setKeysFromSk]);

  const loginWithNpub = useCallback((key: string): boolean => {
    const pk = decodeNpub(key);
    if (!pk) return false;
    setKeysFromPk(pk);
    SecureStore.setItemAsync(STORAGE_KEY_NPUB, key);
    return true;
  }, [setKeysFromPk]);

  const logout = useCallback(() => {
    setPrivateKeyHex(null);
    setPublicKey('');
    setNpub('');
    setNsec(null);
    SecureStore.deleteItemAsync(STORAGE_KEY_NSEC);
    SecureStore.deleteItemAsync(STORAGE_KEY_NPUB);
  }, []);

  return (
    <NostrContext.Provider
      value={{
        privateKeyHex,
        publicKey,
        npub,
        nsec,
        isAuthenticated,
        loaded,
        profile,
        profileLoading,
        createAccount,
        loginWithNsec,
        loginWithNpub,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  return <NostrInner>{children}</NostrInner>;
}

export function useNostr() {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error('useNostr must be used within NostrProvider');
  return ctx;
}
