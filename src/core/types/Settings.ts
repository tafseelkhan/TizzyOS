// types/settings.ts
export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'bn' | 'ur' | 'ta';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ProfileData {
  _id: string;
  name: string;
  image: string;
}

export interface SettingsItem {
  kind?: "header" | "divider";
  segment?: string;
  title: string;
  icon?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  children?: SettingsItem[];
}

export interface LanguageType {
  code: Language;
  name: string;
  nativeName: string;
}