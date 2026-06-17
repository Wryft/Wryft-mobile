import { createContext, useContext, useState, useCallback } from 'react';

export type ThemeMode = 'coal' | 'light';
export type DMPrivacy = 'everyone' | 'contacts' | 'none';

interface Preferences {
  theme: ThemeMode;
  chatFontSize: number;
  typingIndicators: boolean;
  hideKeyboardHints: boolean;
  collapseDMs: boolean;
  dmPrivacy: DMPrivacy;
}

interface PreferencesContextType extends Preferences {
  setTheme: (t: ThemeMode) => void;
  setChatFontSize: (s: number) => void;
  setTypingIndicators: (v: boolean) => void;
  setHideKeyboardHints: (v: boolean) => void;
  setCollapseDMs: (v: boolean) => void;
  setDmPrivacy: (v: DMPrivacy) => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('coal');
  const [chatFontSize, setChatFontSize] = useState(16);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [hideKeyboardHints, setHideKeyboardHints] = useState(false);
  const [collapseDMs, setCollapseDMs] = useState(false);
  const [dmPrivacy, setDmPrivacy] = useState<DMPrivacy>('everyone');

  return (
    <PreferencesContext.Provider
      value={{
        theme, setTheme,
        chatFontSize, setChatFontSize,
        typingIndicators, setTypingIndicators,
        hideKeyboardHints, setHideKeyboardHints,
        collapseDMs, setCollapseDMs,
        dmPrivacy, setDmPrivacy,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
