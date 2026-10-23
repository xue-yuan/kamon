# 戰國家徽圖鑑

收錄戰國大名、公家與寺社家紋的圖鑑網站，以 [Solid](https://solidjs.com) 與 [Vite](https://vite.dev) 製作。

- 依身分、時代、紋樣分類瀏覽，並可搜尋家族、人物或家紋名稱（新舊字體、羅馬拼音皆可）
- 一個家族可有多枚家紋（定紋與替紋），詳細頁可切換
- 系譜（本家與分家）、同系家紋、參考資料與每張圖的來源和授權
- 地圖檢視：各家族根據地（代表人物時期的主要居城）標示在日本地圖上，可縮放
- 中文／日本語切換（介面文字在 `src/locales/`，資料內容的翻譯在各筆資料的 `i18n` 底下）
- 每枚家紋都有自己的網址 `/k/<家紋 id>/`，分享時會顯示該家紋的預覽圖

## 開發

```bash
pnpm install
pnpm dev            # 開發伺服器
pnpm build          # 打包到 dist/，並產生每枚家紋的分享頁與預覽圖
pnpm preview        # 預覽打包結果
pnpm check:data     # 檢查 src/data.js
```

## 資料

所有資料都在 `src/data.js` 的 `KAMON_FAMILIES`，每個家族底下有一或多枚家紋。文字欄位以中文（預設語言）撰寫，其他語言的翻譯放在各筆資料的 `i18n.<語言>` 底下：

```js
{
  id: 'sanada', clan: '真田家', class: 'buke', rank: 'sengokuDaimyo', era: ['sengoku', 'edo'],
  daimyo: '真田幸村 (Sanada Yukimura)',
  parent: 'xxx', parentNote: '…',                     // 選填：出自哪個家族
  seat: { name: '上田城', lat: 36.40, lon: 138.24 },   // 選填：地圖上的根據地
  references: [{ site: 'wikipediaJa', title: '真田氏', url: '…' }],
  i18n: { ja: { clan, daimyo, parentNote, seat } },  // parentNote、seat 在中文有值時必填
  crests: [{
    id: 'sanada', usage: 'jomon', category: 'object',
    motif: '…',                                       // 選填：用來連結同系家紋
    nameJa: '六文錢', nameEn: 'Rokumonsen', description: '…',
    source: { type: 'commons', file, url, author, license, licenseUrl },
    i18n: { ja: { description, sourceNote } },        // sourceNote 在 source.note 有值時必填
    fillRule: 'nonzero',                              // 選填：預設 evenodd；原圖以重疊形狀構成時才需要
    viewBox: '…', path: '…',
  }],
}
```

`class`、`rank`、`era`、`category`、`usage` 存的是 id，可用的值定義在 `src/taxonomy.js`；`rank` 決定首頁的分區，`era` 是 `[起]` 或 `[起, 迄]`，決定時代篩選。

### 語系

介面文字與上述 id 的顯示名稱放在 `src/locales/<語言>.json`（`zh-Hant.json` 為預設），以 [`@solid-primitives/i18n`](https://github.com/solidjs-community/solid-primitives/tree/main/packages/i18n) 讀取：元件以 `t('ui.share')`、`label('rank', id)` 取用，變數寫成 `{{name}}`，缺少的 key 會退回預設語言。資料內容的翻譯以 `localized(record, field)` 取用（見 `src/i18n.js`）。新增語言時：

1. 複製 `zh-Hant.json` 為新的語系檔並翻譯
2. 在 `src/i18n.js` 的 `LANGS` 與 `MESSAGES` 加上該語言
3. 為各筆資料補上 `i18n.<語言>`

`pnpm check:data` 會檢查所有語系檔的 key 與變數是否一致、每個 id 是否都有名稱、每筆資料是否都有各語言的翻譯。

### 新增或替換家紋

```bash
# 從 Wikimedia Commons 新增一個家族（作者與授權會自動帶入）
pnpm add-kamon --url "https://commons.wikimedia.org/wiki/File:xxx.svg" \
  --id example --nameJa 家紋名 --clan 某某氏 --daimyo "人物 (Romaji)" --rank sengokuDaimyo --era sengoku,edo \
  --category plant --description "…" --wikipedia 某某氏 \
  --ja-clan 某某氏 --ja-daimyo 人物 --ja-description "…"

# 為既有家族加上替紋
pnpm add-kamon --url "https://commons.wikimedia.org/wiki/File:xxx.svg" \
  --family date --id date-kuyo --nameJa 九曜 --category nature --motif 九曜紋 --description "…" --ja-description "…"

# 替換某枚家紋的圖（本地檔案需註明來源）
pnpm add-kamon --file art.svg --id chiba --replace --source-file "Japanese crest Tsuki ni Hoshi.svg"
```

完整參數請執行 `pnpm add-kamon` 查看。之後執行 `pnpm check:data`，它會抓出常見問題，例如背景方框、跑出畫面的線段、缺少來源或翻譯、不同家紋共用同一張圖等。

`pnpm optimize:data` 會把所有路徑重新壓縮（`add-kamon` 匯入時已自動套用），重複執行不會改變結果。

## 部署

`pnpm build` 的輸出是純靜態檔案。每枚家紋的分享頁位於 `dist/k/<id>/index.html`，任何靜態主機都能直接提供。

| 環境變數 | 用途 |
| --- | --- |
| `SITE_URL` | 網站的公開網址，例如 `https://kamon.example.com`。大多數社群平台要求預覽圖使用絕對網址，設定後也會產生 `sitemap.xml`。 |
| `BASE_PATH` | 網站不在根目錄時的路徑，例如 GitHub Pages 的 `/kamon/`。 |

```bash
SITE_URL=https://kamon.example.com pnpm build
```

## 授權

家紋圖像大多取自 [Wikimedia Commons](https://commons.wikimedia.org)，每張圖的作者、授權與原始檔案標示在網站的詳細頁，也記錄在 `src/data.js` 各家紋的 `source` 欄位。其中許多採用 CC BY-SA，網站上經轉換的圖形屬於衍生作品，須以相同授權釋出並標示原作者。標為「本站繪製」的家紋是以程式產生的幾何圖形。

說明文字以各家族在日本語版維基百科的條目為主要依據，根據地座標取自 Wikidata。地圖輪廓取自 [Natural Earth](https://www.naturalearthdata.com)（公有領域），由 `node scripts/build-japan-map.mjs` 產生 `src/japanMap.js`。
