const ARG_COUNTS = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const SEPARATOR = /[\s,]*/y;

export function splitSubpaths(d) {
  return analyzeSubpaths(d).map(({ d: sub, size }) => ({ d: sub, size }));
}

export function analyzeSubpaths(d) {
  let pos = 0;
  const skipSeparators = () => {
    SEPARATOR.lastIndex = pos;
    SEPARATOR.exec(d);
    pos = SEPARATOR.lastIndex;
  };
  const readNumber = () => {
    skipSeparators();
    NUMBER.lastIndex = pos;
    const match = NUMBER.exec(d);
    if (!match) return null;
    pos = NUMBER.lastIndex;
    return parseFloat(match[0]);
  };
  const readFlag = () => {
    skipSeparators();
    const ch = d[pos];
    if (ch !== '0' && ch !== '1') return null;
    pos++;
    return +ch;
  };
  const nextIsNumber = () => {
    skipSeparators();
    return pos < d.length && /[0-9+\-.]/.test(d[pos]);
  };

  const subpaths = [];
  let current = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const finish = (end) => {
    if (current) {
      current.d = current.head + d.slice(current.bodyStart, end);
      subpaths.push(current);
    }
  };
  const track = (px, py) => {
    current.points.push(px, py);
  };

  skipSeparators();
  while (pos < d.length) {
    const cmdPos = pos;
    const cmd = d[pos++];
    const lower = cmd.toLowerCase();
    if (!(lower in ARG_COUNTS)) throw new Error(`Unexpected path command '${cmd}' at ${cmdPos}`);
    const rel = cmd === lower;

    if (lower === 'm') {
      finish(cmdPos);
      const mx = readNumber();
      const my = readNumber();
      x = rel ? x + mx : mx;
      y = rel ? y + my : my;
      startX = x;
      startY = y;
      current = { head: `M${x} ${y}`, bodyStart: pos, points: [x, y], ends: [x, y] };
      if (nextIsNumber()) {
        current.head += rel ? 'l' : 'L';
        current.bodyStart = pos;
        while (nextIsNumber()) {
          const lx = readNumber();
          const ly = readNumber();
          x = rel ? x + lx : lx;
          y = rel ? y + ly : ly;
          track(x, y);
          current.ends.push(x, y);
        }
      }
    } else if (lower === 'z') {
      x = startX;
      y = startY;
    } else {
      if (!current) throw new Error('Path does not start with a moveto');
      do {
        if (lower === 'h') {
          const v = readNumber();
          x = rel ? x + v : v;
        } else if (lower === 'v') {
          const v = readNumber();
          y = rel ? y + v : v;
        } else if (lower === 'a') {
          const rx = readNumber();
          const ry = readNumber();
          readNumber();
          readFlag();
          readFlag();
          const ex = readNumber();
          const ey = readNumber();
          track(x - rx, y - ry);
          track(x + rx, y + ry);
          x = rel ? x + ex : ex;
          y = rel ? y + ey : ey;
          track(x - rx, y - ry);
          track(x + rx, y + ry);
        } else {
          const count = ARG_COUNTS[lower];
          for (let i = 0; i < count; i += 2) {
            const px = readNumber();
            const py = readNumber();
            const ax = rel ? x + px : px;
            const ay = rel ? y + py : py;
            track(ax, ay);
            if (i === count - 2) {
              x = ax;
              y = ay;
            }
          }
        }
        track(x, y);
        current.ends.push(x, y);
      } while (nextIsNumber());
    }
    skipSeparators();
  }
  finish(d.length);

  return subpaths.map(({ d: sub, points, ends }) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
    return { d: sub, size: Math.max(maxX - minX, maxY - minY), bbox: [minX, minY, maxX, maxY], ends };
  });
}
