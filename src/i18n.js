import { createSignal } from 'solid-js';
import { flatten, translator, resolveTemplate } from '@solid-primitives/i18n';
import zhHant from './locales/zh-Hant.json';
import ja from './locales/ja.json';

export const DEFAULT_LANG = 'zh-Hant';

export const LANGS = [
  { id: 'zh-Hant', label: '中文' },
  { id: 'ja', label: '日本語' },
];

const MESSAGES = { 'zh-Hant': zhHant, ja };

const STORAGE_KEY = 'kamon-lang';
const ALIASES = { zh: 'zh-Hant' };
const resolve = (id) => (MESSAGES[ALIASES[id] || id] ? ALIASES[id] || id : null);

function initialLang() {
  const fromUrl = resolve(new URLSearchParams(location.search).get('lang'));
  if (fromUrl) return fromUrl;
  try {
    const stored = resolve(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
  }
  return navigator.language?.startsWith('ja') ? 'ja' : DEFAULT_LANG;
}

const [lang, setLangSignal] = createSignal(initialLang());
export { lang };

document.documentElement.lang = lang();

export function setLang(id) {
  setLangSignal(id);
  document.documentElement.lang = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
  }
}

const FLAT = Object.fromEntries(Object.entries(MESSAGES).map(([id, messages]) => [id, flatten(messages)]));

// Keys missing from a translation fall back to the default language
const DICTS = Object.fromEntries(Object.entries(FLAT).map(([id, dict]) => [id, { ...FLAT[DEFAULT_LANG], ...dict }]));

export const t = translator(() => DICTS[lang()], resolveTemplate);

export const label = (kind, id) => t(`${kind}.${id}`);

export const groupLabel = (group) => t(`group.${group.id}.label`);
export const groupNote = (group) => t(`group.${group.id}.note`);

export const formatEra = (era) => era.map((p) => label('period', p)).join('〜');

export const referenceTitle = (ref) => t(`reference.${ref.site}`, { title: ref.title });

// Records hold their text in the default language, with translations under
// `i18n[lang]`; `base` is the default-language value when it isn't record[field]
export function localized(record, field, base = record?.[field]) {
  if (lang() === DEFAULT_LANG) return base;
  return record?.i18n?.[lang()]?.[field] ?? base;
}

// All locale texts for one vocabulary entry, so search matches any language
export const allLabels = (kind, id) => Object.values(FLAT).map((dict) => dict[`${kind}.${id}`] ?? '');

export const familyName = (f) => localized(f, 'clan');
export const personName = (f) => localized(f, 'daimyo');
export const parentNote = (f) => localized(f, 'parentNote');
export const seatName = (f) => localized(f, 'seat', f.seat?.name);
export const crestDescription = (c) => localized(c, 'description');
export const sourceNote = (c) => localized(c, 'sourceNote', c.source?.note);
