import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];
export const DEFAULT_LANGUAGE: Language = 'ko';
export const LANG_KEY = 'mp_language';

const savedLang = localStorage.getItem(LANG_KEY) as Language | null;
const initLang: Language =
  savedLang && SUPPORTED_LANGUAGES.includes(savedLang) ? savedLang : DEFAULT_LANGUAGE;

i18n
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    lng: initLang,
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
  });

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
  localStorage.setItem(LANG_KEY, lang);
}

export default i18n;
