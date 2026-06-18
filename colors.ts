import { usePreferences, type ThemeMode } from './PreferencesContext';

export interface Colors {
  bg: string;
  bgCard: string;
  bgCardAlt: string;
  bgInput: string;
  bgSwatch: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  tabBarBg: string;
  statusBar: 'light-content' | 'dark-content';
  accent: string;
}

const coal: Colors = {
  bg: '#000',
  bgCard: '#111',
  bgCardAlt: '#1A1A1A',
  bgInput: '#1A1A1A',
  bgSwatch: '#4641D9',
  text: '#E0E0E0',
  textSecondary: '#888',
  textMuted: '#666',
  textTertiary: '#555',
  border: '#222',
  borderLight: '#1A1A1A',
  tabBarBg: '#000',
  statusBar: 'light-content',
  accent: '#4641D9',
};

const light: Colors = {
  bg: '#fff',
  bgCard: '#f5f5f5',
  bgCardAlt: '#eee',
  bgInput: '#f0f0f0',
  bgSwatch: '#4641D9',
  text: '#1a1a1a',
  textSecondary: '#666',
  textMuted: '#999',
  textTertiary: '#aaa',
  border: '#e0e0e0',
  borderLight: '#eee',
  tabBarBg: '#fff',
  statusBar: 'dark-content',
  accent: '#4641D9',
};

const palettes: Record<ThemeMode, Colors> = { coal, light };

export function useColors(): Colors {
  const { theme } = usePreferences();
  return palettes[theme];
}
