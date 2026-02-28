const fs = require('fs');
const path = require('path');

const inputDir = process.argv[2] || 'restored_kamon_opt';
const kamonDir = path.isAbsolute(inputDir) ? inputDir : path.join(process.cwd(), inputDir);
const files = fs.readdirSync(kamonDir).filter(f => f.endsWith('.svg'));

const results = {};

files.forEach(file => {
    const filePath = path.join(kamonDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const id = file.replace('.svg', '');

    // Extract viewBox
    const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 100 100";
    const vbParts = viewBox.split(/[ ,]+/).map(Number);
    const vbW = vbParts[2];
    const vbH = vbParts[3];

    // Extract all paths and shapes
    // SVGO might have converted shapes to paths
    const paths = [];
    const pathRegex = /\s+d="([^"]+)"/g;
    let match;

    while ((match = pathRegex.exec(content)) !== null) {
        let d = match[1].trim();
        const tag = match[0];

        // Skip paths that match the viewBox dimensions exactly (usually background)
        // Check for M0 0 hX vY h-X z or similar
        const hMatch = d.match(/[hH]([\d.]+)/);
        const vMatch = d.match(/[vV]([\d.]+)/);
        const isFullRect = hMatch && vMatch &&
            Math.abs(parseFloat(hMatch[1]) - vbW) < 5 &&
            Math.abs(parseFloat(vMatch[1]) - vbH) < 5;

        // If it's a very simple path that covers the whole area, skip it
        if (isFullRect && d.length < 100) {
            continue;
        }

        // Specific skip for big circles/borders if they are too generic
        if (id === 'tokugawa' && d.length < 500 && d.includes('c-153')) {
            continue;
        }

        paths.push(d);
    }

    // Extract circles manually because SVGO might not convert all of them
    const circleRegex = /<circle\b([^>]+)/g;
    let circleMatch;
    while ((circleMatch = circleRegex.exec(content)) !== null) {
        const attrs = circleMatch[1];
        const cxMatch = attrs.match(/\bcx="([^"]+)"/);
        const cyMatch = attrs.match(/\bcy="([^"]+)"/);
        const rMatch = attrs.match(/\br="([^"]+)"/);

        if (cxMatch && cyMatch && rMatch) {
            const cx = parseFloat(cxMatch[1]);
            const cy = parseFloat(cyMatch[1]);
            const r = parseFloat(rMatch[1]);

            // Convert to two arcs forming a full circle
            // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
            const circlePath = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

            // Skip big circles that match exactly the viewBox dimensions (usually background)
            if (Math.abs(r * 2 - Math.min(vbW, vbH)) < 5 && Math.abs(cx - vbW / 2) < 5) {
                // Background circle, skip
                // Actually maybe we should keep it for Kato Since Kato might be just two circles.
                // Wait, if it's Kato, don't skip anything since it has no background rect, just concentric circles.
                if (id !== 'kato') continue;
            }

            paths.push(circlePath);
        }
    }

    // Capture Toyotomi transform if still present (svgo usually eats it)
    let finalViewBox = viewBox;
    if (id === 'toyotomi' && !viewBox.startsWith('-')) {
        const transformMatch = content.match(/transform="translate\(([^, ]+)[, ]+([^)]+)\)"/);
        if (transformMatch) {
            const tx = parseFloat(transformMatch[1]);
            const ty = parseFloat(transformMatch[2]);
            finalViewBox = `${-tx} ${-ty} ${vbW} ${vbH}`;
        }
    }

    if (id === 'kato') {
        results[id] = {
            viewBox: "0 0 478 478",
            path: "M 48 239 A 191 191 0 1 1 430 239 A 191 191 0 1 1 48 239 Z M 176.5 239 A 62.5 62.5 0 1 0 301.5 239 A 62.5 62.5 0 1 0 176.5 239 Z"
        };
        return;
    }

    if (id === 'imperial') {
        // Manual 16x rotation of the petal path M0 0 81-16C103-16 103 16 81 16z
        // We will let our python re-viewboxer handle the sizing.
        const petal = "M0 0 81-16C103-16 103 16 81 16z";
        let fullPath = "";
        for (let i = 0; i < 16; i++) {
            const angle = i * 22.5;
            fullPath += `<g transform="rotate(${angle})"><path d="${petal}" /></g>`;
        }
        // Actually, we need to export it as a SINGLE PATH for our current logic.
        // So we will just trust the one we have OR we better find a flat one.
        // Wait, the one we have has one petal: M0 0 81-16C103-16 103 16 81 16z
        // Let's just create a list of paths in the JS.
    }

    // Reset paths for amago if it looks incomplete
    if (id === 'amago' && paths.length < 2) {
        results[id] = {
            viewBox: "0 0 68 65",
            path: "M0 0H33V32H0zM13 13H20V20H13z M35 0H68V32H35zM48 13H55V20H48z M0 33H33V65H0zM13 46H20V53H13z M35 33H68V65H35zM48 46H55V53H48z"
        };
        return;
    }

    results[id] = {
        viewBox: finalViewBox,
        path: paths.join(' ')
    };
});

console.log(JSON.stringify(results, null, 2));
