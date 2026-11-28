/* Word Connect, Word Cross, Puzzle. Vocabulary from sourced dict.json. No Names as tokens. */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SKEY = 'asma.v1';
  let pack = null, loading = false, kind = '', level = 1, paused = false, won = false;
  let path = [], found = [], bankPick = null, fills = {}, puzzlePath = [];
  let onTickHook = null;

  function T() {
    const D = window.AsmaData && window.AsmaData.T;
    const lang = (readS().lang) || 'en';
    return (D && D[lang]) || (D && D.en) || {};
  }
  function t(k) { const o = T(); return o[k] || (window.AsmaData && window.AsmaData.T.en[k]) || k; }
  function nA(x) {
    const s = readS();
    if (s.arAll && window.AsmaCore) return window.AsmaCore.toAr(x);
    return String(x);
  }
  function readS() {
    try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function patchS(obj) {
    const s = readS();
    s.games = Object.assign({ connect: 1, cross: 1, puzzle: 1, solved: {} }, s.games || {}, obj);
    try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function games() {
    const g = readS().games || {};
    return { connect: g.connect || 1, cross: g.cross || 1, puzzle: g.puzzle || 1, solved: g.solved || {} };
  }
  function wordById(id) {
    const list = (pack && pack.words) || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function meaning(w) {
    if (!w) return '';
    const lang = readS().lang || 'en';
    return lang === 'fr' ? (w.fr || w.en) : (lang === 'ar' ? w.ar : w.en);
  }
  function shuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0 || 1;
    for (let i = a.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function endlessConnect(n) {
    const ws = pack.words;
    const a = ws[(n * 7) % ws.length], b = ws[(n * 13 + 3) % ws.length];
    const letters = shuffle((a.letters + b.letters).split(''), n).join('').slice(0, 8);
    return { n: n, letters: letters, targets: [a.id, b.id] };
  }
  function endlessPuzzle(n) {
    const w = pack.words[(n * 11) % pack.words.length];
    const extra = pack.words[(n * 5 + 1) % pack.words.length].letters[0] || '';
    return { n: n, id: w.id, bank: shuffle((w.letters + extra).split(''), n).join('') };
  }
  function endlessCross(n) {
    const ws = pack.words;
    let a = ws[(n * 3) % ws.length], b = ws[(n * 9 + 2) % ws.length];
    let i = -1, j = -1, k = 0;
    while (j < 0 && k < ws.length) {
      a = ws[(n * 3 + k) % ws.length];
      b = ws[(n * 9 + 2 + k * 2) % ws.length];
      for (i = 0; i < a.letters.length; i++) {
        j = b.letters.indexOf(a.letters[i]);
        if (j >= 0) break;
      }
      k++;
    }
    if (j < 0) { i = 0; j = 0; }
    return {
      n: n, w: Math.max(a.letters.length, i + 1), h: Math.max(b.letters.length, j + 1),
      words: [
        { id: a.id, r: j, c: 0, dir: 'h' },
        { id: b.id, r: 0, c: i, dir: 'v' }
      ]
    };
  }
  function levelOf(k, n) {
    const list = pack[k] || [];
    if (n <= list.length) return list[n - 1];
    if (k === 'connect') return endlessConnect(n);
    if (k === 'cross') return endlessCross(n);
    return endlessPuzzle(n);
  }
  function cap(k) { return (pack && pack[k] && pack[k].length) || 100; }

  function loadPack(done) {
    if (pack) { done(); return; }
    if (loading) return;
    loading = true;
    fetch('content/games.json').then(r => r.ok ? r.json() : null).then(j => {
      pack = j || { words: [], connect: [], cross: [], puzzle: [] };
      loading = false;
      done();
    }).catch(() => { pack = { words: [], connect: [], cross: [], puzzle: [] }; loading = false; done(); });
  }

  function startKind(k, n) {
    kind = k;
    level = Math.max(1, n || games()[k] || 1);
    won = false;
    path = [];
    found = [];
    bankPick = null;
    fills = {};
    puzzlePath = [];
    paint();
  }

  function markSolved() {
    const g = games();
    const key = kind + ':' + level;
    g.solved[key] = true;
    if (level >= (g[kind] || 1)) g[kind] = level + 1;
    patchS({ connect: g.connect, cross: g.cross, puzzle: g.puzzle, solved: g.solved });
    won = true;
    paint();
  }

  function hubHtml() {
    const g = games();
    const kinds = [
      { id: 'connect', title: t('gameConnect'), hint: t('gameConnectHint') },
      { id: 'cross', title: t('gameCross'), hint: t('gameCrossHint') },
      { id: 'puzzle', title: t('gamePuzzle'), hint: t('gamePuzzleHint') }
    ];
    let s = '<div class="pagehead"><h2>' + esc(t('gameTitle')) + '</h2><p>' + esc(t('gameHint')) + '</p></div>';
    s += '<p class="note">' + esc(t('gameTestNote')) + '</p>';
    s += '<p class="note">' + esc(t('gameSource')) + '</p>';
    kinds.forEach(k => {
      const at = g[k.id] || 1;
      s += '<button class="row" data-act="gameOpen" data-kind="' + k.id + '"><div><div class="rn">' + esc(k.title) + '</div><div class="rs">' + esc(k.hint) + '</div></div><span class="rt">' + nA(at) + '</span></button>';
    });
    return s;
  }

  function barHtml() {
    const max = cap(kind);
    const endless = level > max;
    return '<div class="game-bar">' +
      '<button class="btn sm" data-act="gameHub">' + esc(t('gameBack')) + '</button>' +
      '<span>' + esc(t('gameLevel')) + ' ' + nA(level) + (endless ? ' · ' + esc(t('gameEndless')) : '') + '</span>' +
      '<span class="btns" style="margin:0"><button class="btn sm" data-act="gamePrev"' + (level <= 1 ? ' disabled' : '') + '>' + esc(t('gamePrev')) + '</button>' +
      '<button class="btn sm" data-act="gameNext">' + esc(t('gameSkip')) + '</button></span></div>';
  }

  function revealHtml(ids) {
    let s = '<div class="game-win">';
    (ids || []).forEach(id => {
      const w = wordById(id);
      if (!w) return;
      s += '<div class="card dua"><div class="a">' + esc(w.ar) + '</div><div class="tl">' + esc(w.tr) + '</div><div class="tx">' + esc(meaning(w)) + '</div><div class="sr">' + esc(t('source')) + ': ' + esc(w.src) + '</div></div>';
    });
    s += '<div class="btns"><button class="btn pri" data-act="gameNext">' + esc(t('gameNext')) + '</button></div></div>';
    return s;
  }

  function connectHtml() {
    const lv = levelOf('connect', level);
    const letters = (lv.letters || '').split('');
    const targets = lv.targets || [];
    const cur = path.map(i => letters[i]).join('');
    let s = barHtml();
    s += '<p class="note">' + esc(t('gameConnectPlay')) + ' ' + nA(found.length) + ' / ' + nA(targets.length) + '</p>';
    s += '<div class="game-path">' + esc(cur || t('gameTapLetters')) + '</div>';
    s += '<div class="game-ring">';
    letters.forEach((ch, i) => {
      s += '<button type="button" class="game-ch' + (path.indexOf(i) >= 0 ? ' on' : '') + '" data-act="gameTap" data-i="' + i + '">' + esc(ch) + '</button>';
    });
    s += '</div>';
    s += '<div class="btns"><button class="btn sm" data-act="gameClear">' + esc(t('gameClear')) + '</button><button class="btn sm" data-act="gameEnter">' + esc(t('gameEnter')) + '</button></div>';
    s += '<div class="game-found">';
    targets.forEach(id => {
      const w = wordById(id);
      const ok = found.indexOf(id) >= 0;
      s += '<span class="' + (ok ? 'ok' : '') + '">' + (ok && w ? esc(w.ar) : '···') + '</span>';
    });
    s += '</div>';
    if (won) s += revealHtml(targets);
    return s;
  }

  function crossHtml() {
    const lv = levelOf('cross', level);
    const w = lv.w || 6, h = lv.h || 6;
    const map = {};
    (lv.words || []).forEach(p => {
      const wd = wordById(p.id);
      if (!wd) return;
      for (let k = 0; k < wd.letters.length; k++) {
        const r = p.dir === 'v' ? p.r + k : p.r;
        const c = p.dir === 'h' ? p.c + k : p.c;
        map[r + ',' + c] = wd.letters[k];
      }
    });
    const keys = Object.keys(map);
    let s = barHtml();
    s += '<p class="note">' + esc(t('gameCrossPlay')) + '</p>';
    s += '<div class="game-grid" style="grid-template-columns:repeat(' + w + ',minmax(28px,1fr))">';
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const key = r + ',' + c;
        if (!map[key]) { s += '<i class="off"></i>'; continue; }
        const v = fills[key] || '';
        const ok = v === map[key];
        s += '<button type="button" class="game-cell' + (ok ? ' ok' : '') + (bankPick === key ? ' pick' : '') + '" data-act="gameCell" data-k="' + key + '">' + esc(v) + '</button>';
      }
    }
    s += '</div>';
    const pool = shuffle(keys.map(k => map[k]), level + 4);
    s += '<div class="game-bank">';
    pool.forEach((ch, i) => {
      s += '<button type="button" class="game-ch" data-act="gameBank" data-ch="' + esc(ch) + '" data-i="' + i + '">' + esc(ch) + '</button>';
    });
    s += '</div>';
    if (won) s += revealHtml((lv.words || []).map(p => p.id));
    return s;
  }

  function puzzleHtml() {
    const lv = levelOf('puzzle', level);
    const w = wordById(lv.id);
    const bank = (lv.bank || (w && w.letters) || '').split('');
    const cur = puzzlePath.map(i => bank[i]).join('');
    let s = barHtml();
    s += '<p class="note">' + esc(t('gamePuzzlePlay')) + '</p>';
    if (w) s += '<p class="game-clue">' + esc(meaning(w)) + '</p>';
    s += '<div class="game-path">' + esc(cur || t('gameTapLetters')) + '</div>';
    s += '<div class="game-bank">';
    bank.forEach((ch, i) => {
      s += '<button type="button" class="game-ch' + (puzzlePath.indexOf(i) >= 0 ? ' on' : '') + '" data-act="gamePuz" data-i="' + i + '">' + esc(ch) + '</button>';
    });
    s += '</div>';
    s += '<div class="btns"><button class="btn sm" data-act="gameClear">' + esc(t('gameClear')) + '</button></div>';
    if (won && w) s += revealHtml([w.id]);
    return s;
  }

  function paint() {
    const el = document.getElementById('v-games');
    if (!el) return;
    if (!pack) {
      el.innerHTML = '<p class="note">' + esc(t('gameWait')) + '</p>';
      loadPack(paint);
      return;
    }
    if (paused) {
      el.innerHTML = '<div class="pagehead"><h2>' + esc(t('gamePaused')) + '</h2><p>' + esc(t('gamePausedHint')) + '</p></div>';
      return;
    }
    if (!kind) { el.innerHTML = hubHtml(); return; }
    if (kind === 'connect') el.innerHTML = connectHtml();
    else if (kind === 'cross') el.innerHTML = crossHtml();
    else el.innerHTML = puzzleHtml();
  }

  function tryConnectEnter() {
    const lv = levelOf('connect', level);
    const letters = (lv.letters || '').split('');
    const cur = path.map(i => letters[i]).join('');
    path = [];
    const hit = (lv.targets || []).map(wordById).find(w => w && w.letters === cur);
    if (hit && found.indexOf(hit.id) < 0) {
      found.push(hit.id);
      if (found.length >= (lv.targets || []).length) markSolved();
      else paint();
      return;
    }
    paint();
  }

  function tryPuzzle() {
    const lv = levelOf('puzzle', level);
    const w = wordById(lv.id);
    const bank = (lv.bank || '').split('');
    const cur = puzzlePath.map(i => bank[i]).join('');
    if (w && cur === w.letters) markSolved();
  }

  function tryCross() {
    const lv = levelOf('cross', level);
    const map = {};
    (lv.words || []).forEach(p => {
      const wd = wordById(p.id);
      if (!wd) return;
      for (let k = 0; k < wd.letters.length; k++) {
        const r = p.dir === 'v' ? p.r + k : p.r;
        const c = p.dir === 'h' ? p.c + k : p.c;
        map[r + ',' + c] = wd.letters[k];
      }
    });
    const keys = Object.keys(map);
    if (!keys.length) return;
    if (keys.every(k => fills[k] === map[k])) markSolved();
  }

  function onAct(a, el) {
    if (a === 'gameOpen') { startKind(el.dataset.kind, games()[el.dataset.kind]); return true; }
    if (a === 'gameHub') { kind = ''; paint(); return true; }
    if (a === 'gamePrev') { startKind(kind, level - 1); return true; }
    if (a === 'gameSkip') { startKind(kind, level + 1); return true; }
    if (a === 'gameNext') { startKind(kind, level + 1); return true; }
    if (a === 'gameClear') { path = []; puzzlePath = []; paint(); return true; }
    if (a === 'gameTap') {
      const i = +el.dataset.i;
      const at = path.indexOf(i);
      if (at >= 0) path = path.slice(0, at);
      else path.push(i);
      paint();
      return true;
    }
    if (a === 'gameEnter') { tryConnectEnter(); return true; }
    if (a === 'gamePuz') {
      const i = +el.dataset.i;
      if (puzzlePath.indexOf(i) >= 0) return true;
      puzzlePath.push(i);
      tryPuzzle();
      if (!won) paint();
      return true;
    }
    if (a === 'gameCell') { bankPick = el.dataset.k; paint(); return true; }
    if (a === 'gameBank') {
      if (!bankPick) return true;
      fills[bankPick] = el.dataset.ch;
      bankPick = null;
      tryCross();
      if (!won) paint();
      return true;
    }
    return false;
  }

  function onTick(now, nextAt) {
    if (!nextAt) return;
    const ms = nextAt - now;
    if (ms <= 0 && ms > -25000) {
      if (!paused && kind) { paused = true; paint(); }
    } else if (paused && ms > 40000) {
      paused = false;
      if (document.getElementById('v-games')) paint();
    }
  }

  window.AsmaGames = {
    render: function () { paused = false; paint(); },
    onAct: onAct,
    onTick: onTick
  };
})();
