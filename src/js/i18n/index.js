import en from './en.js';
import fr from './fr.js';

const DICTIONARIES = { en, fr };
const STORAGE_KEY = 'naas.locale';

function detectInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && DICTIONARIES[saved]) return saved;
  const nav = (navigator.language || 'en').slice(0, 2);
  return DICTIONARIES[nav] ? nav : 'en';
}

function resolve(dict, path) {
  return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict);
}

export function createI18n() {
  return {
    locale: detectInitial(),
    t(path) {
      const dict = DICTIONARIES[this.locale] || DICTIONARIES.en;
      const hit = resolve(dict, path);
      if (hit !== undefined) return hit;
      return resolve(DICTIONARIES.en, path) ?? path;
    },
    setLocale(next) {
      if (!DICTIONARIES[next]) return;
      this.locale = next;
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    },
    locales() {
      return Object.keys(DICTIONARIES);
    },
  };
}
