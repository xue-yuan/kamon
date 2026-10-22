export const GROUPS = [
  { id: 'tenka', label: '天下人・將軍家', note: '統一天下或開創幕府的家族', ranks: ['天下人', '將軍家'] },
  { id: 'daimyo', label: '戰國大名', note: '割據一方的戰國大名與豐臣五大老', ranks: ['戰國大名', '五大老'] },
  {
    id: 'retainer',
    label: '家臣・武將',
    note: '織田、豐臣、德川、毛利等麾下的名將與重臣',
    ranks: ['五奉行', '德川四天王', '織田家臣', '豐臣家臣', '賤岳七本槍', '毛利家臣', '石田家臣', '劍術家', '雜賀衆', '武將'],
  },
  { id: 'shugo', label: '室町守護', note: '三管領、四職與各國守護大名', ranks: ['三管領', '四職', '守護大名'] },
  { id: 'ancient', label: '源平・南北朝', note: '源平之爭與南北朝時代的武家名門', ranks: ['源氏', '平氏', '南朝武將'] },
  { id: 'court', label: '皇室・公家', note: '皇室、五攝家與古代貴族', ranks: ['天皇家', '四姓', '名門公家', '五攝家'] },
  { id: 'temple', label: '寺社', note: '寺院與宗教勢力', ranks: ['一向宗'] },
];

const OTHER_GROUP = { id: 'other', label: '其他', note: '', ranks: [] };

const GROUP_BY_RANK = new Map(GROUPS.flatMap((g) => g.ranks.map((rank) => [rank, g])));

export function groupOf(family) {
  return GROUP_BY_RANK.get(family.rank) || OTHER_GROUP;
}

export const ALL_GROUPS = [...GROUPS, OTHER_GROUP];

export const CATEGORIES = ['植物紋', '動物紋', '器物紋', '天文 / 自然紋', '幾何 / 文樣紋', '文字紋'];

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

export const PERIODS = ['古代', '奈良', '平安', '鎌倉', '南北朝', '室町', '戰國', '江戶', '近代', '現代'];

export const ERA_BUCKETS = [
  { id: 'heian', label: '平安以前', periods: ['古代', '奈良', '平安'] },
  { id: 'kamakura', label: '鎌倉・南北朝', periods: ['鎌倉', '南北朝'] },
  { id: 'muromachi', label: '室町', periods: ['室町'] },
  { id: 'sengoku', label: '戰國', periods: ['戰國'] },
  { id: 'edo', label: '江戶以後', periods: ['江戶', '近代', '現代'] },
];

export function parseEra(era) {
  const parts = (era || '').split('〜').map((p) => PERIODS.indexOf(p.trim()));
  if (!parts.length || parts.length > 2 || parts.some((i) => i === -1)) return null;
  return [parts[0], parts[parts.length - 1]];
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
