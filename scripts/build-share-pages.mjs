// Runs after `vite build` (see the build script in package.json).
//
// Generates a static page per crest at dist/k/<crest-id>/index.html with its
// own title, description and Open Graph / Twitter card tags, plus a preview
// image at dist/og/<crest-id>.png, so shared links show the crest instead of
// the generic site card. The pages load the same app, which opens the crest
// from the URL.
//
// Environment:
//   SITE_URL   public origin, e.g. https://kamon.example.com (needed for absolute
//              og:url / og:image, which most social sites require, and sitemap.xml)
//   BASE_PATH  path the site is served under (default "/"), same as vite.config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import { KAMON_FAMILIES } from '../src/data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const base = process.env.BASE_PATH || '/';
const site = (process.env.SITE_URL || '').replace(/\/$/, '');
const absolute = (p) => (site ? site + p : p);

// Share pages are in the default language
const messages = JSON.parse(fs.readFileSync(path.join(root, 'src', 'locales', 'zh-Hant.json'), 'utf8'));
const SITE_TITLE = messages.ui.siteTitle;
const SITE_DESCRIPTION = messages.ui.siteDescription;

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

function page({ title, description, url, image }) {
  const tags = [
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:site_name" content="${SITE_TITLE}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${escape(absolute(url))}" />`,
    `<meta property="og:image" content="${escape(absolute(image))}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    site ? `<link rel="canonical" href="${escape(absolute(url))}" />` : '',
  ].filter(Boolean);
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
}

// Preview image: the crest in gold, drawn the way the site draws it
function crestSvg(crest, x, y, size) {
  const vbWidth = +crest.viewBox.trim().split(/[\s,]+/)[2];
  const hairline = (2.4 * vbWidth) / size;
  const ring = crest.ringPath
    ? `<path d="${crest.ringPath}" fill="none" stroke="#f2d47e" stroke-width="${crest.ringStrokeWidth || hairline}"/>`
    : '';
  const fill = crest.fillNone ? 'none' : 'rgba(212,175,55,0.4)';
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${crest.viewBox}">${ring}<path d="${crest.path}" fill="${fill}" fill-rule="${crest.fillRule || 'evenodd'}" stroke="#f2d47e" stroke-width="${crest.strokeWidth || hairline}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function card(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#d4af37" stop-opacity="0.16"/><stop offset="1" stop-color="#d4af37" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="#050507"/>
<circle cx="600" cy="315" r="330" fill="url(#glow)"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#d4af37" stroke-opacity="0.35" stroke-width="2"/>
${inner}
</svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

fs.mkdirSync(path.join(dist, 'og'), { recursive: true });

// Home page card: a row of well-known crests
const featured = ['oda', 'tokugawa', 'toyotomi', 'takeda', 'sanada']
  .map((id) => KAMON_FAMILIES.find((f) => f.id === id).crests[0]);
fs.writeFileSync(
  path.join(dist, 'og', 'home.png'),
  card(featured.map((crest, i) => crestSvg(crest, 70 + i * 220, 225, 180)).join(''))
);
fs.writeFileSync(
  path.join(dist, 'index.html'),
  page({ title: SITE_TITLE, description: SITE_DESCRIPTION, url: base, image: `${base}og/home.png` })
);

const urls = [base];
let count = 0;
for (const family of KAMON_FAMILIES) {
  for (const crest of family.crests) {
    const url = `${base}k/${encodeURIComponent(crest.id)}/`;
    const image = `${base}og/${encodeURIComponent(crest.id)}.png`;
    const text = crest.description || `${family.clan}的家紋。`;
    const description = text.length > 110 ? text.slice(0, 110) + '…' : text;
    fs.writeFileSync(path.join(dist, 'og', `${crest.id}.png`), card(crestSvg(crest, 375, 90, 450)));
    const dir = path.join(dist, 'k', crest.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      page({ title: `${family.clan}「${crest.nameJa}」｜${SITE_TITLE}`, description, url, image })
    );
    urls.push(url);
    count++;
  }
}

if (site) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escape(site + u)}</loc></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);
} else {
  console.warn('SITE_URL is not set: og:url / og:image are relative and no sitemap.xml was written.');
}
console.log(`Share pages: ${count} crest pages and preview images in dist/k and dist/og.`);
