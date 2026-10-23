export const GROUPS = [
  { id: 'tenka', ranks: ['tenkabito', 'shogunHouse'] },
  { id: 'daimyo', ranks: ['sengokuDaimyo', 'goTairo'] },
  {
    id: 'retainer',
    ranks: ['goBugyo', 'tokugawaShitenno', 'odaRetainer', 'toyotomiRetainer', 'shichihonYari', 'moriRetainer', 'ishidaRetainer', 'swordsman', 'saikaShu'],
  },
  { id: 'shugo', ranks: ['sanKanrei', 'shishiki', 'shugoDaimyo'] },
  { id: 'ancient', ranks: ['genji', 'heishi', 'southernCourt'] },
  { id: 'court', ranks: ['imperialHouse', 'shisei', 'courtNoble', 'gosekke'] },
  { id: 'temple', ranks: ['ikkoShu'] },
];

const OTHER_GROUP = { id: 'other', ranks: [] };

const GROUP_BY_RANK = new Map(GROUPS.flatMap((g) => g.ranks.map((rank) => [rank, g])));

export function groupOf(family) {
  return GROUP_BY_RANK.get(family.rank) || OTHER_GROUP;
}

export const ALL_GROUPS = [...GROUPS, OTHER_GROUP];

export const RANKS = GROUPS.flatMap((g) => g.ranks);

export const CLASSES = ['buke', 'kuge', 'imperial', 'religious'];

export const CATEGORIES = ['plant', 'animal', 'object', 'nature', 'geometric', 'character'];

export const USAGES = ['jomon', 'kaemon', 'jimon'];

export const PERIODS = ['ancient', 'nara', 'heian', 'kamakura', 'nanbokucho', 'muromachi', 'sengoku', 'edo', 'modern', 'contemporary'];

export const ERA_BUCKETS = [
  { id: 'heian', periods: ['ancient', 'nara', 'heian'] },
  { id: 'kamakura', periods: ['kamakura', 'nanbokucho'] },
  { id: 'muromachi', periods: ['muromachi'] },
  { id: 'sengoku', periods: ['sengoku'] },
  { id: 'edo', periods: ['edo', 'modern', 'contemporary'] },
];

// `era` is [from] or [from, to]; returns their indexes in PERIODS, or null if invalid
export function parseEra(era) {
  if (!Array.isArray(era) || !era.length || era.length > 2) return null;
  const span = era.map((p) => PERIODS.indexOf(p));
  if (span.includes(-1) || span[0] > span[span.length - 1]) return null;
  return [span[0], span[span.length - 1]];
}

export function eraBucketsOf(era) {
  const span = parseEra(era);
  if (!span) return [];
  return ERA_BUCKETS.filter((bucket) =>
    bucket.periods.some((p) => {
      const i = PERIODS.indexOf(p);
      return i >= span[0] && i <= span[1];
    })
  ).map((bucket) => bucket.id);
}

const VARIANTS = {
  條: '条', 國: '国', 澤: '沢', 齋: '斎', 齊: '斉', 淺: '浅', 內: '内', 鄉: '郷', 黑: '黒',
  德: '徳', 豐: '豊', 龍: '竜', 萬: '万', 藝: '芸', 衞: '衛', 眞: '真', 傳: '伝', 濱: '浜',
  邊: '辺', 邉: '辺', 廣: '広', 櫻: '桜', 會: '会', 實: '実', 壽: '寿', 榮: '栄', 劍: '剣',
  錢: '銭', 鐵: '鉄', 圓: '円', 對: '対', 戰: '戦', 繼: '継', 經: '経', 賴: '頼', 嚴: '厳',
  兩: '両', 龜: '亀', 氣: '気', 樂: '楽', 學: '学', 寶: '宝', 將: '将', 總: '総', 稱: '称',
  獨: '独', 發: '発', 變: '変', 樣: '様', 惠: '恵', 藏: '蔵', 姬: '姫', 嶋: '島', 蘆: '芦',
  鹽: '塩', 爲: '為', 歲: '歳', 莊: '荘', 團: '団', 黨: '党', 譽: '誉', 舊: '旧', 隱: '隠',
  顯: '顕', 豫: '予', 單: '単', 聲: '声', 處: '処', 屬: '属', 擔: '担', 讓: '譲', 號: '号',
  鬪: '闘', 鬥: '闘', 雙: '双', 臺: '台', 竪: '縦',
};

export function normalize(text) {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/./gu, (ch) => VARIANTS[ch] || ch);
}

export function searchTerms(query) {
  return (query || '').split(/\s+/).map(normalize).filter(Boolean);
}
