import fs from 'fs';
import { parseArgs } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { optimize } from 'svgo';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// SVGO configuration exactly as used in svgo.config.js
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

async function fetchSvg(url) {
    console.log(`Fetching SVG from ${url}...`);

    let finalUrl = url;

    // If given a Wikimedia File: page, use the API to get the direct file URL
    if (url.includes('File:')) {
        const filename = url.split('File:')[1].split('#')[0];
        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${filename}&prop=imageinfo&iiprop=url&format=json`;
        console.log(`Resolving File URL via API: ${apiUrl}`);

        const apiResponse = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) kamon-adder' }
        });
        const apiData = await apiResponse.json();
        const pages = apiData.query.pages;
        const page = Object.values(pages)[0];

        if (!page.imageinfo || Object.keys(page.imageinfo).length === 0) {
            throw new Error(`Could not find image info for ${filename} via API. Check if the filename is correct.`);
        }

        finalUrl = page.imageinfo[0].url;
        console.log(`Resolved direct SVG link: ${finalUrl}`);
    }

    const response = await fetch(finalUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width/100 kamon-adder'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text.includes('<svg') && !text.includes('<?xml')) {
        throw new Error("Target URL did not return a valid SVG.");
    }
    return text;
}

function processSvg(rawSvg) {
    console.log('Optimizing SVG with SVGO...');
    // We remove removeViewBox from our config here because we actively need it
    const config = JSON.parse(JSON.stringify(svgoConfig));
    config.plugins = config.plugins.filter(p => p !== 'removeViewBox');

    const result = optimize(rawSvg, config);

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

    let pathData = '';
    $('path').each((_, elem) => {
        pathData += $(elem).attr('d') + ' ';
    });

    pathData = pathData.trim();
    if (!pathData) {
        throw new Error("No path data found in optimized SVG");
    }

    return { viewBox, path: pathData };
}

function updateDataJs(newEntry) {
    const dataFilePath = path.join(projectRoot, 'src', 'data.js');
    console.log(`Updating ${dataFilePath}...`);

    if (!fs.existsSync(dataFilePath)) {
        throw new Error(`data.js not found at ${dataFilePath}`);
    }

    const currentData = fs.readFileSync(dataFilePath, 'utf8');
    const match = currentData.match(/export const KAMON_DATA = (\[[\s\S]*\]);/);
    if (!match) {
        throw new Error("Could not parse existing KAMON_DATA from data.js");
    }

    let existingData;
    // We use eval here because it's a JS object structure, not strict JSON
    try {
        existingData = eval('(' + match[1] + ')');
    } catch (e) {
        throw new Error("Error evaluating existing KAMON_DATA: " + e.message);
    }

    if (existingData.some((k) => k.id === newEntry.id)) {
        throw new Error(`Kamon with ID '${newEntry.id}' already exists.`);
    }

    existingData.push(newEntry);

    const newContent = `export const KAMON_DATA = ${JSON.stringify(existingData, null, 2)};\n`;
    fs.writeFileSync(dataFilePath, newContent, 'utf8');

    console.log(`Successfully added '${newEntry.nameJa}' (${newEntry.id}) to data.js!`);
}

async function main() {
    const options = {
        url: { type: 'string' },
        id: { type: 'string' },
        nameJa: { type: 'string' },
        nameEn: { type: 'string' },
        daimyo: { type: 'string' },
        clan: { type: 'string' },
        class: { type: 'string', default: '武家' },
        category: { type: 'string' },
        usage: { type: 'string', default: '定紋' }
    };

    const { values, positionals } = parseArgs({ options, strict: false });

    if (!values.url || !values.id || !values.nameJa) {
        console.error("Usage: node tools/add_kamon.js --url <svg-url> --id <kamon-id> --nameJa <japanese-name> [other options...]");
        console.error("Required: --url, --id, --nameJa");
        console.error("Optional: --nameEn, --daimyo, --clan, --class (default: 武家), --category, --usage (default: 定紋)");
        process.exit(1);
    }

    try {
        const rawSvg = await fetchSvg(values.url);
        const { viewBox, path } = processSvg(rawSvg);

        const newEntry = {
            id: values.id,
            clan: values.clan || '',
            class: values.class,
            category: values.category || '未分類',
            usage: values.usage,
            nameJa: values.nameJa,
            nameEn: values.nameEn || '',
            daimyo: values.daimyo || '',
            viewBox,
            path
        };

        updateDataJs(newEntry);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

main();
