// Shrinks the crest paths in src/data.js. Run with `npm run optimize:data`.
//
// Each path is rewritten with relative coordinates (shorter numbers) rounded
// to 1/1000 of the crest's viewBox, well under a pixel at any size the site
// draws. Every point is first snapped to that grid in absolute terms and the
// relative value is measured from where the *rounded* path actually is, so
// errors never accumulate along long runs of segments. The command structure itself is left untouched, and
// running the script again does not change already-optimized paths.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data.js');

const ARG_COUNTS = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
const TOKEN = /[MmLlTtHhVvCcSsQqAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

// Parses into commands with absolute coordinates.
function parse(d) {
  const tokens = d.match(TOKEN) || [];
  const commands = [];
  let i = 0;
  let x = 0, y = 0, sx = 0, sy = 0;
  let cmd = null;
  const num = () => parseFloat(tokens[i++]);
  // Arc flags may be packed together ("01"); the tokenizer reads them as one number
  const flags = [];
  const flag = () => {
    if (flags.length) return flags.shift();
    const t = tokens[i++];
    if (t.length > 1 && /^[01]+$/.test(t)) {
      flags.push(...t.slice(1).split('').map(Number));
      return +t[0];
    }
    return +t;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error('Path must start with a command');
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    if (lower === 'z') {
      commands.push({ type: 'z' });
      x = sx;
      y = sy;
      cmd = null;
      continue;
    }
    if (lower === 'h') {
      const v = num();
      x = rel ? x + v : v;
      commands.push({ type: 'h', x });
    } else if (lower === 'v') {
      const v = num();
      y = rel ? y + v : v;
      commands.push({ type: 'v', y });
    } else if (lower === 'a') {
      const rx = num(), ry = num(), rot = num(), large = flag(), sweep = flag();
      const ex = num(), ey = num();
      const start = [x, y];
      x = rel ? x + ex : ex;
      y = rel ? y + ey : ey;
      commands.push({ type: 'a', rx, ry, rot, large, sweep, x, y, start });
    } else {
      const pts = [];
      for (let k = 0; k < ARG_COUNTS[lower]; k += 2) {
        const px = num(), py = num();
        pts.push([rel ? x + px : px, rel ? y + py : py]);
      }
      [x, y] = pts[pts.length - 1];
      commands.push({ type: lower, pts });
      if (lower === 'm') {
        sx = x;
        sy = y;
        cmd = rel ? 'l' : 'L'; // implicit lineto after a moveto
      }
    }
  }
  return commands;
}

function formatter(precision) {
  return (v) => {
    let s = v.toFixed(precision);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace(/^(-?)0\./, '$1.');
  };
}

function serialize(commands, precision) {
  const fmt = formatter(precision);
  // Arc radii get an extra digit: if a rounded radius ends up shorter than
  // half the chord, browsers enlarge it and the arc visibly shifts.
  const fmtRadius = formatter(precision + 1);
  const round = (v) => +fmt(v);
  let out = '';
  let prev = '';
  let rx = 0, ry = 0, sx = 0, sy = 0; // where the rounded path currently is
  const emit = (letter, values) => {
    let s = letter === prev && letter !== 'M' ? '' : letter;
    for (const v of values) {
      const t = typeof v === 'string' ? v : fmt(v);
      const last = s || out;
      const needsSpace = /[\d.]$/.test(last) && !t.startsWith('-') && !(t.startsWith('.') && /\.\d*$/.test(last.match(/[-\d.]*$/)[0]));
      s += (needsSpace ? ' ' : '') + t;
    }
    out += s;
    // After an absolute M, bare coordinate pairs mean absolute L, so a
    // following relative l must always spell out its letter.
    prev = letter === 'M' ? 'L' : letter;
  };
  for (const c of commands) {
    switch (c.type) {
      case 'm': {
        const [x, y] = c.pts[0];
        emit('M', [x, y]);
        rx = sx = round(x);
        ry = sy = round(y);
        break;
      }
      case 'z':
        out += 'z';
        prev = 'z';
        rx = sx;
        ry = sy;
        break;
      case 'h': {
        const dx = round(round(c.x) - rx);
        emit('h', [dx]);
        rx += dx;
        break;
      }
      case 'v': {
        const dy = round(round(c.y) - ry);
        emit('v', [dy]);
        ry += dy;
        break;
      }
      case 'a': {
        const dx = round(round(c.x) - rx), dy = round(round(c.y) - ry);
        let radiusX = c.rx;
        let radiusY = c.ry;
        // A semicircle's centre is extremely sensitive to its chord: once the
        // endpoints are rounded, the exact radius can put the centre well off
        // the chord. A slightly shorter radius makes browsers scale it back to
        // exactly half the chord (SVG arc radius correction).
        const chord = Math.hypot(c.x - c.start[0], c.y - c.start[1]);
        if (c.rx === c.ry && Math.abs(c.rx - chord / 2) <= c.rx * 1e-3) {
          radiusX = radiusY = (Math.hypot(dx, dy) / 2) * 0.99;
        }
        emit('a', [fmtRadius(radiusX), fmtRadius(radiusY), c.rot, String(c.large), String(c.sweep), dx, dy]);
        rx += dx;
        ry += dy;
        break;
      }
      default: {
        const values = [];
        let ex = rx, ey = ry;
        for (const [x, y] of c.pts) {
          const dx = round(round(x) - rx), dy = round(round(y) - ry);
          values.push(dx, dy);
          ex = rx + dx;
          ey = ry + dy;
        }
        emit(c.type, values);
        rx = ex;
        ry = ey;
      }
    }
    // Keep accumulated sums exact at the chosen precision
    rx = round(rx);
    ry = round(ry);
  }
  return out;
}

export function optimizePath(d, viewBox) {
  const size = Math.max(...viewBox.trim().split(/[\s,]+/).map(Number).slice(2));
  const precision = Math.max(0, Math.ceil(Math.log10(1000 / size)));
  return serialize(parse(d), precision);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = fs.readFileSync(dataFile, 'utf8');
  const families = eval('(' + source.match(/export const KAMON_FAMILIES = (\[[\s\S]*\]);/)[1] + ')');
  let before = 0;
  let after = 0;
  for (const family of families) {
    for (const crest of family.crests) {
      for (const key of ['path', 'ringPath']) {
        if (!crest[key]) continue;
        before += crest[key].length;
        crest[key] = optimizePath(crest[key], crest.viewBox);
        after += crest[key].length;
      }
    }
  }
  fs.writeFileSync(dataFile, `export const KAMON_FAMILIES = ${JSON.stringify(families, null, 2)};\n`);
  console.log(`Paths: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
}
