import { createSignal } from 'solid-js';

export const LANGS = [
  { id: 'zh', label: '中文', htmlLang: 'zh-Hant' },
  { id: 'ja', label: '日本語', htmlLang: 'ja' },
];

const STORAGE_KEY = 'kamon-lang';

function initialLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.some((l) => l.id === fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGS.some((l) => l.id === stored)) return stored;
  } catch {
  }
  return navigator.language?.startsWith('ja') ? 'ja' : 'zh';
}

const [lang, setLangSignal] = createSignal(initialLang());
export { lang };

const applyHtmlLang = (id) => {
  document.documentElement.lang = LANGS.find((l) => l.id === id).htmlLang;
};
applyHtmlLang(lang());

export function setLang(id) {
  setLangSignal(id);
  applyHtmlLang(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
  }
}

const isJa = () => lang() === 'ja';

const UI = {
  zh: {
    siteTitle: '戰國家徽圖鑑',
    stats: '收錄 {families} 個家族・{crests} 枚家紋',
    skipLink: '跳到家紋列表',
    viewTabs: '檢視方式',
    viewGallery: '圖鑑',
    viewMap: '地圖',
    language: '語言',
    searchPlaceholder: '搜尋家族、人物、家紋或城名，例如：真田、Nobunaga、桐、大坂城',
    search: '搜尋',
    facetGroup: '身分',
    facetEra: '時代',
    facetCategory: '紋樣',
    all: '全部',
    showing: '顯示 {count} 個家族',
    clearFilters: '清除篩選',
    noResults: '找不到符合條件的家紋。',
    crestCount: '{count} 紋',
    crestCountTitle: '共 {count} 枚家紋',
    footer: '家紋圖像多取自 Wikimedia Commons，各圖的作者與授權標示於詳細頁；經本站轉換的圖形依原圖授權（多為 CC BY-SA）釋出。地圖輪廓取自 Natural Earth。',
    close: '關閉',
    switchCrest: '切換家紋',
    share: '分享',
    copied: '已複製連結',
    copyPrompt: '複製這個連結：',
    representative: '代表人物',
    rank: '身分',
    era: '時代',
    seat: '根據地',
    pattern: '紋樣',
    fallbackDescription: '{clan}所使用的家徽。',
    lineage: '系譜',
    branches: '分出家族',
    relatedCrests: '同系家紋',
    references: '參考資料',
    imageSource: '圖片來源',
    sourceUnknown: '來源未標示',
    basedOn: '依據',
    familyNav: '切換家族',
    prev: '上一個',
    next: '下一個',
    mapHint: '地圖顯示 {count} 個家族的根據地（代表人物時期的主要居城或居所）。點擊數字標記可放大該區域，放大後可拖曳移動。',
    mapCluster: '{count} 個家族：{names}',
    zoomIn: '放大',
    zoomOut: '縮小',
    zoomReset: '全圖',
    listSeparator: '、',
  },
  ja: {
    siteTitle: '戦国家紋図鑑',
    stats: '{families} 家・{crests} 紋を収録',
    skipLink: '家紋一覧へ移動',
    viewTabs: '表示',
    viewGallery: '図鑑',
    viewMap: '地図',
    language: '言語',
    searchPlaceholder: '家名・人物・家紋・城名で検索（例：真田、Nobunaga、桐、大坂城）',
    search: '検索',
    facetGroup: '身分',
    facetEra: '時代',
    facetCategory: '紋様',
    all: 'すべて',
    showing: '{count} 家を表示',
    clearFilters: '絞り込みを解除',
    noResults: '条件に合う家紋が見つかりません。',
    crestCount: '{count} 紋',
    crestCountTitle: '家紋 {count} 点',
    footer: '家紋画像の多くは Wikimedia Commons より。各画像の作者とライセンスは詳細画面に記載しています。当サイトで変換した図形は原図のライセンス（主に CC BY-SA）に従って公開しています。地図の輪郭は Natural Earth より。',
    close: '閉じる',
    switchCrest: '家紋を切り替え',
    share: '共有',
    copied: 'リンクをコピーしました',
    copyPrompt: 'このリンクをコピーしてください：',
    representative: '代表的人物',
    rank: '身分',
    era: '時代',
    seat: '本拠地',
    pattern: '紋様',
    fallbackDescription: '{clan}の家紋。',
    lineage: '系譜',
    branches: '分家',
    relatedCrests: '同系の家紋',
    references: '参考資料',
    imageSource: '画像の出典',
    sourceUnknown: '出典未記載',
    basedOn: '原図',
    familyNav: '家を切り替え',
    prev: '前へ',
    next: '次へ',
    mapHint: '{count} 家の本拠地（代表的人物の時代の主な居城・居所）を表示しています。数字の付いた印をクリックするとその地域を拡大でき、拡大後はドラッグで移動できます。',
    mapCluster: '{count} 家：{names}',
    zoomIn: '拡大',
    zoomOut: '縮小',
    zoomReset: '全体',
    listSeparator: '、',
  },
};

export function t(key, vars = {}) {
  const text = UI[lang()][key] ?? UI.zh[key];
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

const JA_TERMS = {
  rank: {
    將軍家: '将軍家', 戰國大名: '戦国大名', 德川四天王: '徳川四天王', 豐臣家臣: '豊臣家臣',
    賤岳七本槍: '賤ヶ岳七本槍', 劍術家: '剣術家', 雜賀衆: '雑賀衆', 武將: '武将',
    南朝武將: '南朝方の武将', 五攝家: '五摂家',
  },
  class: {},
  usage: {},
  category: { '天文 / 自然紋': '天文・自然紋', '幾何 / 文樣紋': '幾何・文様紋' },
  period: { 戰國: '戦国', 江戶: '江戸' },
  group: {
    tenka: ['天下人・将軍家', '天下を統一し、または幕府を開いた家'],
    daimyo: ['戦国大名', '各地に割拠した戦国大名と豊臣五大老'],
    retainer: ['家臣・武将', '織田・豊臣・徳川・毛利などに仕えた名将と重臣'],
    shugo: ['室町守護', '三管領・四職と各国の守護大名'],
    ancient: ['源平・南北朝', '源平の争乱と南北朝時代の武家の名門'],
    court: ['皇室・公家', '皇室・五摂家と古代の貴族'],
    temple: ['寺社', '寺院と宗教勢力'],
    other: ['その他', ''],
  },
  eraBucket: { heian: '平安以前', kamakura: '鎌倉・南北朝', muromachi: '室町', sengoku: '戦国', edo: '江戸以降' },
};

export function term(kind, value) {
  if (!isJa() || value == null) return value;
  return JA_TERMS[kind][value] ?? value;
}

export const eraText = (era) => (era || '').split('〜').map((p) => term('period', p)).join('〜');

export const groupLabel = (group) => (isJa() ? JA_TERMS.group[group.id]?.[0] ?? group.label : group.label);
export const groupNote = (group) => (isJa() ? JA_TERMS.group[group.id]?.[1] ?? group.note : group.note);
export const eraBucketLabel = (bucket) => (isJa() ? JA_TERMS.eraBucket[bucket.id] ?? bucket.label : bucket.label);

export const familyName = (f) => (isJa() && f.ja?.clan) || f.clan;
export const personName = (f) => (isJa() && f.ja?.daimyo) || f.daimyo;
export const parentNote = (f) => (isJa() && f.ja?.parentNote) || f.parentNote;
export const seatName = (f) => (isJa() && f.ja?.seat) || f.seat?.name;
export const crestDescription = (c) => (isJa() && c.ja?.description) || c.description;
export const sourceNote = (c) => (isJa() && c.ja?.sourceNote) || c.source?.note;
export const referenceTitle = (ref) => (isJa() ? ref.title.replace('（日本語版維基百科）', '（ウィキペディア）') : ref.title);
