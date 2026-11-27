import en from './en.json';
import ar from './ar.json';

const DICTS = { en, ar };
const LANG_KEY = 'ab_lang';

let currentLang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
})();

const listeners = new Set();

export function applyDocLang(lang = currentLang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  const next = lang === 'ar' ? 'ar' : 'en';
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // ignore storage errors
  }
  applyDocLang(next);
  listeners.forEach((fn) => fn(next));
}

export function toggleLang() {
  setLang(currentLang === 'en' ? 'ar' : 'en');
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(path, vars = {}) {
  const dict = DICTS[currentLang] || DICTS.en;
  const parts = path.split('.');
  let val = dict;
  for (const part of parts) {
    if (val && Object.prototype.hasOwnProperty.call(val, part)) {
      val = val[part];
    } else {
      val = undefined;
      break;
    }
  }
  if (val === undefined) {
    // fallback to English
    val = DICTS.en;
    for (const part of parts) {
      val = val && val[part];
    }
  }
  if (typeof val !== 'string') return path;
  return val.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : ''
  );
}

export function localize(obj, fieldBase) {
  if (!obj) return '';
  const key = `${fieldBase}_${currentLang}`;
  const fallback = `${fieldBase}_en`;
  return obj[key] || obj[fallback] || '';
}
