/* Build 100 connect, cross and puzzle levels from sourced dict.json words. */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'web', 'content', 'dict.json');
const dst = path.join(__dirname, '..', 'web', 'content', 'games.json');
const dict = JSON.parse(fs.readFileSync(src, 'utf8'));

const SKIP = new Set(['الله', 'الرحمن', 'الرحيم', 'العظيم', 'بسمالله']);

function letters(ar) {
  return Array.from(ar).filter(c => c >= '\u0621' && c <= '\u064A').join('');
}
function counts(s) {
  const m = {};
  for (const c of s) m[c] = (m[c] || 0) + 1;
  return m;
}
function canSpell(word, pool) {
  const need = counts(word);
  for (const k of Object.keys(need)) if ((pool[k] || 0) < need[k]) return false;
  return true;
}
function addPool(a, b) {
  const o = Object.assign({}, a);
  for (const k of Object.keys(b)) o[k] = (o[k] || 0) + b[k];
  return o;
}
function poolStr(m) {
  let s = '';
  Object.keys(m).sort().forEach(k => { s += k.repeat(m[k]); });
  return s;
}
function shuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function meanShort(en) {
  const t = String(en || '').split('.')[0];
  return t.length > 90 ? t.slice(0, 87) + '...' : t;
}

const words = [];
dict.words.forEach((w, i) => {
  const L = letters(w.ar);
  if (L.length < 3 || L.length > 7) return;
  if (SKIP.has(L)) return;
  words.push({
    id: i,
    ar: w.ar,
    letters: L,
    tr: w.tr,
    en: meanShort(w.en),
    fr: meanShort(w.fr),
    src: 'Penrice 1873; Lane 1863-1893; Kazimirski 1860'
  });
});

function findShare(a, b) {
  for (let i = 0; i < a.length; i++) {
    const j = b.indexOf(a[i]);
    if (j >= 0) return { i: i, j: j, ch: a[i] };
  }
  return null;
}

function makeCross(seed, nWords) {
  const order = shuffle(words, seed);
  let picks = [];
  for (let i = 0; i < order.length && picks.length < nWords; i++) {
    if (!picks.length) { picks.push(order[i]); continue; }
    if (picks.some(p => findShare(p.letters, order[i].letters))) picks.push(order[i]);
  }
  if (picks.length < 2) return null;
  const placed = [];
  const A = picks[0];
  placed.push({ id: A.id, r: 4, c: 0, dir: 'h', letters: A.letters });
  const used = new Set([A.id]);
  for (let p = 1; p < picks.length; p++) {
    const B = picks[p];
    let ok = false;
    for (let q = 0; q < placed.length && !ok; q++) {
      const P = placed[q];
      const sh = findShare(P.letters, B.letters);
      if (!sh) continue;
      if (P.dir === 'h') {
        placed.push({ id: B.id, r: P.r - sh.j, c: P.c + sh.i, dir: 'v', letters: B.letters });
      } else {
        placed.push({ id: B.id, r: P.r + sh.i, c: P.c - sh.j, dir: 'h', letters: B.letters });
      }
      used.add(B.id);
      ok = true;
    }
    if (!ok) continue;
  }
  if (placed.length < 2) return null;
  let minR = 99, minC = 99, maxR = 0, maxC = 0;
  placed.forEach(p => {
    const dr = p.dir === 'v' ? p.letters.length - 1 : 0;
    const dc = p.dir === 'h' ? p.letters.length - 1 : 0;
    minR = Math.min(minR, p.r); minC = Math.min(minC, p.c);
    maxR = Math.max(maxR, p.r + dr); maxC = Math.max(maxC, p.c + dc);
  });
  placed.forEach(p => { p.r -= minR; p.c -= minC; });
  const h = maxR - minR + 1, w = maxC - minC + 1;
  if (h > 12 || w > 12) return null;
  const cells = {};
  for (const p of placed) {
    for (let k = 0; k < p.letters.length; k++) {
      const r = p.dir === 'v' ? p.r + k : p.r;
      const c = p.dir === 'h' ? p.c + k : p.c;
      const key = r + ',' + c;
      const ch = p.letters[k];
      if (cells[key] && cells[key] !== ch) return null;
      cells[key] = ch;
    }
  }
  return {
    w: w,
    h: h,
    words: placed.map(p => ({ id: p.id, r: p.r, c: p.c, dir: p.dir }))
  };
}

function makeConnect(seed, nTargets) {
  const order = shuffle(words, seed);
  const main = order[0];
  let pool = counts(main.letters);
  const targets = [main.id];
  for (let i = 1; i < order.length && targets.length < nTargets; i++) {
    const w = order[i];
    if (w.id === main.id) continue;
    if (canSpell(w.letters, addPool(pool, counts(w.letters))) && canSpell(w.letters, addPool(pool, counts('')))) {
      /* prefer words already in pool; if not, add missing letters sparingly */
    }
    const need = counts(w.letters);
    let extra = 0;
    const next = Object.assign({}, pool);
    for (const k of Object.keys(need)) {
      if ((next[k] || 0) < need[k]) {
        extra += need[k] - (next[k] || 0);
        next[k] = need[k];
      }
    }
    if (extra > 3) continue;
    if (poolStr(next).length > 10) continue;
    pool = next;
    targets.push(w.id);
  }
  if (targets.length < 2) return null;
  return { letters: shuffle(poolStr(pool).split(''), seed + 9).join(''), targets: targets };
}

function makePuzzle(seed, extraN) {
  const w = words[seed % words.length];
  let extra = '';
  const others = shuffle(words, seed + 3).filter(x => x.id !== w.id);
  for (const o of others) {
    if (extra.length >= extraN) break;
    extra += o.letters[0];
  }
  extra = extra.slice(0, extraN);
  const bank = shuffle((w.letters + extra).split(''), seed + 11).join('');
  return { id: w.id, bank: bank };
}

const connect = [], cross = [], puzzle = [];
let s = 7;
for (let n = 1; n <= 100 && connect.length < 100; n++) {
  const need = n < 25 ? 3 : (n < 60 ? 4 : 5);
  let lv = null;
  for (let t = 0; t < 40 && !lv; t++) lv = makeConnect(s++, need);
  if (lv) connect.push(Object.assign({ n: connect.length + 1 }, lv));
}
s = 91;
for (let n = 1; n <= 400 && cross.length < 100; n++) {
  const nw = cross.length < 25 ? 2 : (cross.length < 70 ? 3 : 4);
  let lv = null;
  for (let t = 0; t < 80 && !lv; t++) lv = makeCross(s++, nw);
  if (lv) cross.push(Object.assign({ n: cross.length + 1 }, lv));
}
while (cross.length < 100) {
  const lv = makeCross(s++, 2);
  if (lv) cross.push(Object.assign({ n: cross.length + 1 }, lv));
  if (s > 20000) break;
}
for (let n = 1; n <= 100; n++) {
  const extra = n < 30 ? 0 : (n < 70 ? 1 : 2);
  puzzle.push(Object.assign({ n: n }, makePuzzle(n * 17 + 3, extra)));
}

const out = {
  note: 'Levels built from the Penrice / Lane / Kazimirski dictionary batch. Not Names of Allah as tokens. No audio in this pack.',
  source: dict.source,
  words: words,
  connect: connect,
  cross: cross,
  puzzle: puzzle
};
fs.writeFileSync(dst, JSON.stringify(out));
console.log('words', words.length, 'connect', connect.length, 'cross', cross.length, 'puzzle', puzzle.length, 'bytes', fs.statSync(dst).size);
