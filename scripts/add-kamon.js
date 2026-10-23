import fs from 'fs';
import { parseArgs } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { optimize } from 'svgo';
import * as cheerio from 'cheerio';
import { optimizePath } from './optimize-paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// SVGO settings for turning a Commons SVG into a single flat path
const svgoConfig = {
    multipass: true,
    plugins: [
        'preset-default',
        'convertStyleToAttrs',
        {
            name: 'removeAttrs',
            params: {
                attrs: '(fill|stroke.*|style|class|id|data-name)'
            }
        },
        'removeDimensions',
        'removeViewBox',
        {
            name: 'addAttributesToSVGElement',
            params: {
                attributes: [
                    { fill: 'currentColor' }
                ]
            }
        },
        {
            name: 'convertShapeToPath',
            params: {
                convertArcs: true
            }
        },
        'mergePaths'
    ]
};

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'kamon-archive/1.0 (add_kamon.js)';

// Looks up a Commons file's download URL plus the attribution the site shows
// for it (author and license).
async function commonsFile(filename) {
    const params = new URLSearchParams({
        action: 'query',
        titles: `File:${filename}`,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        format: 'json'
    });
    const apiResponse = await fetch(`${COMMONS_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    const apiData = await apiResponse.json();
    const page = Object.values(apiData.query.pages)[0];
    if (!page.imageinfo || page.imageinfo.length === 0) {
        throw new Error(`Could not find image info for ${filename} via API. Check if the filename is correct.`);
    }
    const info = page.imageinfo[0];
    const meta = info.extmetadata || {};
    const text = (key) => (meta[key]?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return {
        downloadUrl: info.url,
        source: {
            type: 'commons',
            file: page.title.replace(/^File:/, ''),
            url: info.descriptionurl,
            author: text('Artist').slice(0, 140),
            license: text('LicenseShortName') || '未標示',
            licenseUrl: text('LicenseUrl') || undefined
        }
    };
}

async function fetchSvg(url) {
    console.log(`Fetching SVG from ${url}...`);

    let finalUrl = url;
    let source;

    // If given a Wikimedia File: page, use the API to get the direct file URL
    // and its attribution
    if (url.includes('File:')) {
        const filename = decodeURIComponent(url.split('File:')[1].split('#')[0]);
        const file = await commonsFile(filename);
        finalUrl = file.downloadUrl;
        source = file.source;
        console.log(`Resolved direct SVG link: ${finalUrl}`);
    }

    const response = await fetch(finalUrl, { headers: { 'User-Agent': USER_AGENT } });

    if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text.includes('<svg') && !text.includes('<?xml')) {
        throw new Error("Target URL did not return a valid SVG.");
    }
    return { svg: text, source };
}

// Illustrator exports declare namespaces as DTD entities (xmlns="&ns_svg;"),
// which SVGO cannot parse; expand them and drop the DOCTYPE.
function expandDoctypeEntities(rawSvg) {
    const doctype = rawSvg.match(/<!DOCTYPE[^[>]*(\[([\s\S]*?)\])?\s*>/);
    if (!doctype) return rawSvg;
    let svg = rawSvg.replace(doctype[0], '');
    for (const [, name, value] of (doctype[2] || '').matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)"\s*>/g)) {
        svg = svg.split(`&${name};`).join(value);
    }
    return svg;
}

// Many Commons crests ship a full-canvas <rect> as background. Since the app
// draws outlines only, it would show up as a square frame around the crest.
function stripBackgroundRects(rawSvg) {
    const $ = cheerio.load(rawSvg, { xmlMode: true });
    const svgTag = $('svg').first();
    const vb = (svgTag.attr('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const width = vb.length === 4 ? vb[2] : parseFloat(svgTag.attr('width'));
    const height = vb.length === 4 ? vb[3] : parseFloat(svgTag.attr('height'));
    if (!width || !height) return rawSvg;

    $('rect').each((_, elem) => {
        const w = $(elem).attr('width') || '';
        const h = $(elem).attr('height') || '';
        const covers = (v, full) => v.endsWith('%') ? parseFloat(v) >= 95 : parseFloat(v) >= full * 0.95;
        if (covers(w, width) && covers(h, height)) {
            $(elem).remove();
        }
    });
    return $.xml();
}

function processSvg(rawSvg) {
    console.log('Optimizing SVG with SVGO...');
    // We remove removeViewBox from our config here because we actively need it
    const config = JSON.parse(JSON.stringify(svgoConfig));
    config.plugins = config.plugins.filter(p => p !== 'removeViewBox');

    const result = optimize(stripBackgroundRects(expandDoctypeEntities(rawSvg)), config);

    if (result.modernError) {
        throw new Error(`SVGO optimization failed: ${result.modernError}`);
    }

    console.log('Parsing optimized SVG to extract paths...');
    const $ = cheerio.load(result.data, { xmlMode: true });
    const svgTag = $('svg');
    const viewBox = svgTag.attr('viewBox');

    if (!viewBox) {
        throw new Error("Could not find viewBox attribute in optimized SVG");
    }

    // Paths are flattened into a single `d`, so anything that still depends on
    // a transform or a <use> reference would silently render in the wrong place.
    if ($('[transform]').length || $('use').length) {
        throw new Error("Optimized SVG still contains transforms or <use> elements; flatten it before importing");
    }

    let pathData = '';
    $('path').each((_, elem) => {
        // A path's first moveto is absolute even when written as `m`; once
        // concatenated after another path it would become relative.
        pathData += $(elem).attr('d').trim().replace(/^m/, 'M') + ' ';
    });

    pathData = pathData.trim();
    if (!pathData) {
        throw new Error("No path data found in optimized SVG");
    }

    return { viewBox, path: pathData };
}

const FAMILY_FIELDS = ['clan', 'class', 'rank', 'era', 'daimyo'];
const CREST_FIELDS = ['category', 'motif', 'usage', 'nameJa', 'nameEn', 'description', 'source'];

// Translations live under record.i18n[lang]; merge rather than replace them
const mergeI18n = (record, lang, fields) => {
    if (!fields) return;
    record.i18n = { ...record.i18n, [lang]: { ...record.i18n?.[lang], ...fields } };
};

function readFamilies(dataFilePath) {
    if (!fs.existsSync(dataFilePath)) {
        throw new Error(`data.js not found at ${dataFilePath}`);
    }

    const currentData = fs.readFileSync(dataFilePath, 'utf8');
    const match = currentData.match(/export const KAMON_FAMILIES = (\[[\s\S]*\]);/);
    if (!match) {
        throw new Error("Could not parse existing KAMON_FAMILIES from data.js");
    }

    // We use eval here because it's a JS object structure, not strict JSON
    try {
        return eval('(' + match[1] + ')');
    } catch (e) {
        throw new Error("Error evaluating existing KAMON_FAMILIES: " + e.message);
    }
}

function pick(values, fields) {
    const out = {};
    for (const field of fields) {
        if (values[field] !== undefined) out[field] = values[field];
    }
    return out;
}

// Three modes:
//   new family:      --id <id> (creates the family and its main crest with the same id)
//   extra crest:     --family <family-id> --id <crest-id> (e.g. an alternate crest)
//   replace:         --id <crest-id> --replace (art plus any fields passed)
function updateDataJs(values, art) {
    const dataFilePath = path.join(projectRoot, 'src', 'data.js');
    console.log(`Updating ${dataFilePath}...`);

    const families = readFamilies(dataFilePath);
    const findCrest = (id) => {
        for (const family of families) {
            const crest = family.crests.find((c) => c.id === id);
            if (crest) return { family, crest };
        }
        return null;
    };
    const existing = findCrest(values.id);

    let verb;
    if (values.replace) {
        if (!existing) {
            throw new Error(`Kamon with ID '${values.id}' does not exist, nothing to replace.`);
        }
        Object.assign(existing.family, pick(values, FAMILY_FIELDS));
        mergeI18n(existing.family, 'ja', values.familyJa);
        mergeI18n(existing.crest, 'ja', values.crestJa);
        Object.assign(existing.crest, pick(values, CREST_FIELDS), art);
        verb = 'updated';
    } else {
        if (existing) {
            throw new Error(`Kamon with ID '${values.id}' already exists. Use --replace to update it.`);
        }
        const crest = {
            id: values.id,
            category: values.category,
            motif: values.motif,
            usage: values.usage || (values.family ? 'kaemon' : 'jomon'),
            nameJa: values.nameJa,
            nameEn: values.nameEn || '',
            description: values.description || '',
            source: values.source,
            ...art
        };
        mergeI18n(crest, 'ja', values.crestJa);
        if (values.family) {
            const family = families.find((f) => f.id === values.family);
            if (!family) {
                throw new Error(`Family '${values.family}' does not exist.`);
            }
            family.crests.push(crest);
        } else {
            const family = {
                id: values.id,
                clan: values.clan || '',
                class: values.class || 'buke',
                rank: values.rank || '',
                era: values.era,
                daimyo: values.daimyo || '',
                references: values.wikipedia
                    ? [{ site: 'wikipediaJa', title: values.wikipedia, url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(values.wikipedia)}` }]
                    : [],
                crests: [crest]
            };
            mergeI18n(family, 'ja', values.familyJa);
            families.push(family);
        }
        verb = 'added';
    }

    const newContent = `export const KAMON_FAMILIES = ${JSON.stringify(families, null, 2)};\n`;
    fs.writeFileSync(dataFilePath, newContent, 'utf8');

    console.log(`Successfully ${verb} '${values.nameJa || values.id}' (${values.id}) in data.js!`);
}

async function main() {
    const options = {
        url: { type: 'string' },
        file: { type: 'string' },
        replace: { type: 'boolean', default: false },
        family: { type: 'string' },
        id: { type: 'string' },
        nameJa: { type: 'string' },
        nameEn: { type: 'string' },
        daimyo: { type: 'string' },
        clan: { type: 'string' },
        class: { type: 'string' },
        rank: { type: 'string' },
        era: { type: 'string' },
        category: { type: 'string' },
        motif: { type: 'string' },
        usage: { type: 'string' },
        description: { type: 'string' },
        'source-file': { type: 'string' },
        'source-note': { type: 'string' },
        wikipedia: { type: 'string' },
        'ja-clan': { type: 'string' },
        'ja-daimyo': { type: 'string' },
        'ja-description': { type: 'string' },
        'ja-source-note': { type: 'string' }
    };

    const { values } = parseArgs({ options, strict: false });
    const source = values.url || values.file;

    if (!source || !values.id || (!values.replace && !values.nameJa)) {
        console.error("Usage: npm run add-kamon -- (--url <svg-url> | --file <svg-path>) --id <kamon-id> --nameJa <japanese-name> [other options...]");
        console.error("       npm run add-kamon -- (--url <svg-url> | --file <svg-path>) --family <family-id> --id <crest-id> --nameJa <japanese-name> [crest options...]");
        console.error("       npm run add-kamon -- (--url <svg-url> | --file <svg-path>) --id <crest-id> --replace [fields to change...]");
        console.error("Required: --url or --file, --id, and --nameJa unless --replace is given");
        console.error("Family options: --clan, --class (default: buke), --rank, --era (e.g. sengoku or sengoku,edo), --daimyo");
        console.error("Crest options: --nameEn, --category, --motif, --usage (default: jomon, or kaemon with --family), --description");
        console.error("Reference: --wikipedia <article title on ja.wikipedia.org> (new family)");
        console.error("Vocabulary ids (class, rank, era, category, usage) are listed in src/taxonomy.js");
        console.error("Japanese: --ja-clan, --ja-daimyo (new family), --ja-description, --ja-source-note (with --source-note)");
        console.error("Source: taken from the Commons page when --url is a File: page; with --file pass --source-file <Commons file name>");
        console.error("        for art taken from Commons, or --source-note <text> (plus optional --source-file) for art drawn or redrawn here");
        process.exit(1);
    }

    try {
        let rawSvg;
        let source;
        if (values.file) {
            rawSvg = fs.readFileSync(path.resolve(values.file), 'utf8');
        } else {
            ({ svg: rawSvg, source } = await fetchSvg(values.url));
        }
        if (values['source-file']) {
            ({ source } = await commonsFile(values['source-file']));
        }
        if (values['source-note']) {
            source = source
                ? { ...source, type: 'derived', note: values['source-note'] }
                : { type: 'original', note: values['source-note'] };
        }
        if (source) values.source = source;
        const jaCrest = {
            ...(values['ja-description'] ? { description: values['ja-description'] } : {}),
            ...(values['ja-source-note'] ? { sourceNote: values['ja-source-note'] } : {})
        };
        if (Object.keys(jaCrest).length) values.crestJa = jaCrest;
        if (values.era) values.era = values.era.split(',').map((p) => p.trim());
        if (values['ja-clan'] || values['ja-daimyo']) {
            values.familyJa = {
                ...(values['ja-clan'] ? { clan: values['ja-clan'] } : {}),
                ...(values['ja-daimyo'] ? { daimyo: values['ja-daimyo'] } : {})
            };
        }
        else if (!values.replace) {
            throw new Error('Unknown art source: pass --source-file or --source-note (or use a Commons File: --url)');
        }

        const { viewBox, path: rawPath } = processSvg(rawSvg);
        const pathData = optimizePath(rawPath, viewBox);

        updateDataJs(values, { viewBox, path: pathData });
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

main();
