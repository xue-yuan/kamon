import { CREST_INDEX } from './catalog';

const BASE = import.meta.env.BASE_URL;

export const HOME_URL = BASE;

export function crestUrl(id) {
  return `${BASE}k/${encodeURIComponent(id)}/`;
}

export function crestIdFromLocation() {
  const rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  const match = rest.match(/^k\/([^/]+)\/?$/);
  const id = match ? decodeURIComponent(match[1]) : decodeURIComponent(location.hash.slice(1));
  return CREST_INDEX.has(id) ? id : null;
}
