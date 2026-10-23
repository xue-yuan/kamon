// Validates src/data.js. Run with `npm run check:data`.
//
// Errors fail the run; warnings point at things worth a look (e.g. two
// different crests sharing identical artwork).
import { KAMON_FAMILIES } from '../src/data.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_GROUPS, ERA_BUCKETS, RANKS, CLASSES, CATEGORIES, USAGES, PERIODS, parseEra } from '../src/taxonomy.js';
import { analyzeSubpaths } from '../src/splitPath.js';

const LOCALE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');
const DEFAULT_LANG = 'zh-Hant';
const LOCALES = Object.fromEntries(
  fs.readdirSync(LOCALE_DIR).filter((f) => f.endsWith('.json')).map((f) => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, f), 'utf8'))])
);
const TRANSLATIONS = Object.keys(LOCALES).filter((l) => l !== DEFAULT_LANG);
const REFERENCE_SITES = Object.keys(LOCALES[DEFAULT_LANG].reference);

// Translated record fields: [field, required only when this returns true]
const FAMILY_I18N = [['clan'], ['daimyo'], ['parentNote', (f) => f.parentNote], ['seat', (f) => f.seat]];
const CREST_I18N = [['description'], ['sourceNote', (c) => c.source?.note]];
const SOURCE_TYPES = ['commons', 'derived', 'original'];

const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const isBlank = (v) => typeof v !== 'string' || !v.trim();

const familyIds = new Set();
const crestIds = new Set();
const pathOwners = new Map();
const motifCounts = new Map();

function checkPath(where, d, viewBox) {
  if (isBlank(d)) return error(where, 'empty path');
  if (!/^\s*M/.test(d)) error(where, 'path must start with an absolute M');
  let pieces;
  try {
    pieces = analyzeSubpaths(d);
  } catch (e) {
    return error(where, `path does not parse (${e.message})`);
  }
  const [x0, y0, w, h] = viewBox;
  for (const [i, piece] of pieces.entries()) {
    const [minX, minY, maxX, maxY] = piece.bbox;
    const m = 0.05 * Math.max(w, h);
    if (maxX < x0 - m || minX > x0 + w + m || maxY < y0 - m || minY > y0 + h + m) {
      error(where, `subpath ${i} lies entirely outside the viewBox`);
    }
    // A subpath spanning the whole canvas with points on all four corners is
    // a background rectangle; drawn as an outline it becomes a square frame.
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw >= 0.95 * w && bh >= 0.95 * h) {
      const tol = 0.03 * Math.max(bw, bh);
      const corners = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]];
      const hits = corners.filter(([cx, cy]) => {
        for (let j = 0; j < piece.ends.length; j += 2) {
          if (Math.abs(piece.ends[j] - cx) < tol && Math.abs(piece.ends[j + 1] - cy) < tol) return true;
        }
        return false;
      });
      if (hits.length === 4) error(where, `subpath ${i} looks like a background rectangle`);
    }
  }
}

function checkSource(where, source) {
  if (!source || typeof source !== 'object') return error(where, 'missing source');
  if (!SOURCE_TYPES.includes(source.type)) return error(where, `unknown source type "${source.type}"`);
  if (source.type === 'commons' || (source.type === 'derived' && source.file)) {
    for (const key of ['file', 'url', 'license']) {
      if (isBlank(source[key])) error(where, `source.${key} is required for a Commons file`);
    }
    if (source.url && !source.url.startsWith('https://commons.wikimedia.org/')) {
      error(where, 'source.url should be the Commons file page');
    }
    if (isBlank(source.author)) warn(where, 'source has no author');
  }
  if (source.type !== 'commons' && isBlank(source.note)) error(where, 'source.note should explain how the art was made');
}

for (const family of KAMON_FAMILIES) {
  const where = `family ${family.id}`;
  if (isBlank(family.id)) error('family', 'missing id');
  if (familyIds.has(family.id)) error(where, 'duplicate family id');
  familyIds.add(family.id);

  for (const key of ['clan', 'daimyo']) if (isBlank(family[key])) error(where, `missing ${key}`);
  if (!CLASSES.includes(family.class)) error(where, `unknown class "${family.class}"`);
  if (!RANKS.includes(family.rank)) error(where, `rank "${family.rank}" is not in any group (src/taxonomy.js)`);
  if (!parseEra(family.era)) error(where, `era ${JSON.stringify(family.era)} should be [from] or [from, to] of PERIODS (src/taxonomy.js)`);

  if (!Array.isArray(family.references) || !family.references.length) {
    error(where, 'needs at least one reference');
  } else {
    for (const ref of family.references) {
      if (isBlank(ref.title) || !/^https:\/\//.test(ref.url || '')) error(where, 'reference needs a title and an https url');
      if (!REFERENCE_SITES.includes(ref.site)) error(where, `unknown reference site "${ref.site}"`);
    }
  }

  if (family.parent !== undefined && isBlank(family.parentNote)) error(where, 'parent needs a parentNote');

  // Japanese versions of the shown text (see src/i18n.js)
  for (const lang of TRANSLATIONS) {
    for (const [field, when] of FAMILY_I18N) {
      if ((!when || when(family)) && isBlank(family.i18n?.[lang]?.[field])) error(where, `needs i18n.${lang}.${field}`);
    }
  }

  if (family.seat) {
    const { name, lat, lon } = family.seat;
    if (isBlank(name)) error(where, 'seat needs a name');
    if (!(lat > 24 && lat < 46 && lon > 122 && lon < 146)) error(where, `seat ${name} is outside Japan (${lat}, ${lon})`);
  }

  if (!Array.isArray(family.crests) || !family.crests.length) {
    error(where, 'has no crests');
    continue;
  }
  if (family.crests[0].usage === '替紋') error(where, 'the first crest should be the 定紋, not a 替紋');

  for (const crest of family.crests) {
    const cw = `crest ${crest.id}`;
    if (isBlank(crest.id)) error(where, 'crest without id');
    if (crestIds.has(crest.id)) error(cw, 'duplicate crest id');
    crestIds.add(crest.id);

    for (const key of ['nameJa', 'nameEn', 'description']) if (isBlank(crest[key])) error(cw, `missing ${key}`);
    for (const lang of TRANSLATIONS) {
      for (const [field, when] of CREST_I18N) {
        if ((!when || when(crest)) && isBlank(crest.i18n?.[lang]?.[field])) error(cw, `needs i18n.${lang}.${field}`);
      }
    }
    if (!CATEGORIES.includes(crest.category)) error(cw, `unknown category "${crest.category}"`);
    if (!USAGES.includes(crest.usage)) error(cw, `unknown usage "${crest.usage}"`);
    if (crest.fillRule !== undefined && !['evenodd', 'nonzero'].includes(crest.fillRule)) {
      error(cw, `fillRule must be "evenodd" (the default) or "nonzero"`);
    }

    const viewBox = String(crest.viewBox || '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
      error(cw, `bad viewBox "${crest.viewBox}"`);
      continue;
    }
    checkPath(cw, crest.path, viewBox);
    if (crest.ringPath) checkPath(`${cw} ring`, crest.ringPath, viewBox);
    checkSource(cw, crest.source);

    if (crest.motif) motifCounts.set(crest.motif, (motifCounts.get(crest.motif) || 0) + 1);
    const owners = pathOwners.get(crest.path) || [];
    owners.push(crest);
    pathOwners.set(crest.path, owners);
  }
}

// Locale files: every language has the same keys, and every vocabulary id
// used by the data has a label
const keysOf = (node, prefix = '') =>
  Object.entries(node).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const defaultKeys = new Set(keysOf(LOCALES[DEFAULT_LANG]));
const valueAt = (messages, key) => key.split('.').reduce((node, part) => node?.[part], messages);
const placeholders = (text) => [...String(text).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
for (const [lang, messages] of Object.entries(LOCALES)) {
  const keys = new Set(keysOf(messages));
  for (const k of defaultKeys) if (!keys.has(k)) error(`locale ${lang}`, `missing "${k}"`);
  for (const k of keys) if (!defaultKeys.has(k)) error(`locale ${lang}`, `"${k}" is not in ${DEFAULT_LANG}`);
  for (const k of keys) {
    const text = valueAt(messages, k);
    // Templates use {{name}} (@solid-primitives/i18n); a single-brace {name} is never filled in
    if (/(^|[^{])\{\w+\}(?!\})/.test(text)) error(`locale ${lang}`, `"${k}" uses {name}; placeholders are written {{name}}`);
    if (defaultKeys.has(k) && placeholders(text) !== placeholders(valueAt(LOCALES[DEFAULT_LANG], k))) {
      error(`locale ${lang}`, `"${k}" has different placeholders than ${DEFAULT_LANG}`);
    }
  }
}
const VOCABULARY = {
  rank: RANKS, class: CLASSES, category: CATEGORIES, usage: USAGES, period: PERIODS,
  eraBucket: ERA_BUCKETS.map((b) => b.id), group: ALL_GROUPS.map((g) => g.id),
};
for (const [kind, ids] of Object.entries(VOCABULARY)) {
  for (const id of ids) if (!LOCALES[DEFAULT_LANG][kind]?.[id]) error(`locale ${DEFAULT_LANG}`, `no label for ${kind}.${id}`);
}

// Second pass: references between families
const byId = new Map(KAMON_FAMILIES.map((f) => [f.id, f]));
for (const family of KAMON_FAMILIES) {
  if (family.parent === undefined) continue;
  if (!byId.has(family.parent)) {
    error(`family ${family.id}`, `parent "${family.parent}" does not exist`);
    continue;
  }
  const seen = new Set([family.id]);
  for (let p = byId.get(family.parent); p; p = byId.get(p.parent)) {
    if (seen.has(p.id)) {
      error(`family ${family.id}`, 'parent chain has a cycle');
      break;
    }
    seen.add(p.id);
  }
}

for (const [motif, count] of motifCounts) {
  if (count < 2) warn(`motif ${motif}`, 'used by only one crest, so it links to nothing');
}

for (const owners of pathOwners.values()) {
  if (owners.length < 2) continue;
  const motifs = new Set(owners.map((c) => c.motif));
  const names = new Set(owners.map((c) => c.nameJa));
  if (motifs.size > 1 || (!owners[0].motif && names.size > 1)) {
    warn(owners.map((c) => c.id).join(', '), 'share identical artwork but are different crests');
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
const crestCount = KAMON_FAMILIES.reduce((n, f) => n + (f.crests?.length || 0), 0);
console.log(`\nChecked ${KAMON_FAMILIES.length} families, ${crestCount} crests: ${errors.length} errors, ${warnings.length} warnings.`);
process.exit(errors.length ? 1 : 0);
