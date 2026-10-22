import { KAMON_FAMILIES } from './data';
import { groupOf, normalize, eraBucketsOf } from './taxonomy';

export const FAMILY_INDEX = new Map(KAMON_FAMILIES.map((family) => [family.id, family]));

export const CREST_INDEX = new Map();
for (const family of KAMON_FAMILIES) {
  for (const crest of family.crests) CREST_INDEX.set(crest.id, { family, crest });
}

export const CREST_COUNT = CREST_INDEX.size;

export const SEARCH_INDEX = KAMON_FAMILIES.map((family) => ({
  family,
  group: groupOf(family),
  eras: eraBucketsOf(family.era),
  familyText: normalize(
    [family.id, family.clan, family.daimyo, family.rank, family.class, family.era, family.seat?.name, family.ja?.clan, family.ja?.daimyo, family.ja?.seat].join(' ')
  ),
  crestTexts: family.crests.map((c) => normalize([c.id, c.nameJa, c.nameEn, c.category, c.usage, c.motif].join(' '))),
}));

export function matchEntry(entry, { terms = [], group = null, category = null, era = null }) {
  if (group && entry.group.id !== group) return null;
  if (era && !entry.eras.includes(era)) return null;
  const crests = entry.family.crests;
  const candidates = crests.filter((crest, i) => {
    if (category && crest.category !== category) return false;
    const text = entry.familyText + '|' + entry.crestTexts[i];
    return terms.every((t) => text.includes(t));
  });
  if (!candidates.length) return null;
  if (terms.length) {
    const direct = candidates.find((c) => terms.some((t) => entry.crestTexts[crests.indexOf(c)].includes(t)));
    if (direct) return direct;
  }
  return candidates[0];
}

export function filterFamilies(filters) {
  return SEARCH_INDEX.flatMap((entry) => {
    const crest = matchEntry(entry, filters);
    return crest ? [{ family: entry.family, group: entry.group, crest }] : [];
  });
}

const MOTIF_INDEX = new Map();
for (const { family, crest } of CREST_INDEX.values()) {
  if (!crest.motif) continue;
  if (!MOTIF_INDEX.has(crest.motif)) MOTIF_INDEX.set(crest.motif, []);
  MOTIF_INDEX.get(crest.motif).push({ family, crest });
}

export function motifPeers(crest) {
  if (!crest.motif) return [];
  return MOTIF_INDEX.get(crest.motif).filter((entry) => entry.crest !== crest);
}

export function ancestorsOf(family) {
  const chain = [];
  const seen = new Set([family.id]);
  for (let p = FAMILY_INDEX.get(family.parent); p && !seen.has(p.id); p = FAMILY_INDEX.get(p.parent)) {
    seen.add(p.id);
    chain.unshift(p);
  }
  return chain;
}

const CHILDREN = new Map();
for (const family of KAMON_FAMILIES) {
  if (!family.parent) continue;
  if (!CHILDREN.has(family.parent)) CHILDREN.set(family.parent, []);
  CHILDREN.get(family.parent).push(family);
}

export function childrenOf(family) {
  return CHILDREN.get(family.id) || [];
}
