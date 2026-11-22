/* Asma Island: floating pill. Shares settings with the main app through localStorage. */
(function () {
'use strict';

const D = window.AsmaData, C = window.AsmaCore, NAMES = window.NAMES;
const desk = window.asmaDesktop || null;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

/* extra strings (same as the main app) */
Object.assign(D.T.en, { fastTag: 'Fasting day', jumuah: "Jumu'ah" });
Object.assign(D.T.fr, { fastTag: 'Jour de jeûne', jumuah: 'Joumou’a' });
Object.assign(D.T.ar, { fastTag: 'يوم صيام', jumuah: 'الجمعة' });

/* ---------- settings (read from the main app's store) ---------- */
const SKEY = 'asma.v1';
const DEF = {
  lang: 'en', arClock: true, arAll: false, h24: false, method: 'MWL', asr: 1,
  adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  imsakMin: 10, hijriAdj: 0, hijriMaghrib: true, weekStart: 1,
  loc: { auto: true, lat: 5.36, lng: -4.0083, name: 'Abidjan' },
  sound: 'bundled', adhanFajr: '2', adhanDhuhr: '3', adhanMaghrib: '1', routine: null, fasting: {}, lastCheck: null, fresh: true
};
function rawStore() { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } }
function load() {
  const s = rawStore();
  const o = Object.assign(clone(DEF), s);
  o.adj = Object.assign(clone(DEF.adj), s.adj || {});
  o.loc = Object.assign(clone(DEF.loc), s.loc || {});
  if (!Array.isArray(o.routine)) o.routine = clone(D.ROUTINE);
  if (!o.fasting || typeof o.fasting !== 'object') o.fasting = {};
  if (!s.adhanMaghrib && s.adhanOther) o.adhanMaghrib = s.adhanOther;
  if (!s.lang) { const nl = (navigator.language || 'en').slice(0, 2); if (nl === 'fr' || nl === 'ar') o.lang = nl; }
  return o;
}
function patchStore(obj) {
  const s = rawStore();
  Object.assign(s, obj);
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
let S = load();
function applyLang() { document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; }

/* ---------- helpers ---------- */
const t = k => (D.T[S.lang] && D.T[S.lang][k]) || D.T.en[k] || k;
const L = o => (o && (o[S.lang] || o.en)) || '';
const nA = x => S.arAll ? C.toAr(x) : String(x);
const nC = x => S.arClock ? C.toAr(x) : String(x);
const pad = C.pad;
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const period = h => S.lang === 'ar' ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'AM' : 'PM');
function fmtHM(d) {
  if (!(d instanceof Date) || isNaN(d)) return t('noTime');
  let h = d.getHours(); const m = pad(d.getMinutes());
  if (S.h24) return nA(pad(h) + ':' + m);
  const p = period(h); h = h % 12 || 12;
  return nA(h + ':' + m) + ' ' + p;
}
const fmtGreg = (d, dow) => (dow ? D.DAYS[S.lang][d.getDay()] + (S.lang === 'ar' ? '، ' : ', ') : '') + nA(d.getDate()) + ' ' + D.MONTHS_G[S.lang][d.getMonth()] + ' ' + nA(d.getFullYear());
const fmtHijri = h => nA(h.d) + ' ' + D.MONTHS_H[S.lang][h.m - 1] + ' ' + nA(h.y) + ' ' + t('hijriShort');
const dur = ms => nC(C.fmtDur(ms));

/* ---------- prayer logic ---------- */
let tmCache = new Map();
const cfg = () => ({ lat: S.loc.lat, lng: S.loc.lng, method: S.method, asr: S.asr, adj: S.adj, imsakMin: S.imsakMin });
function timesFor(date) {
  const k = dkey(date); let v = tmCache.get(k);
  if (!v) { v = C.dayTimes(date.getFullYear(), date.getMonth() + 1, date.getDate(), cfg()); tmCache.set(k, v); }
  return v;
}
function nextPrayer(now) {
  const today = timesFor(now);
  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) if (today[k] > now) return { key: k, at: today[k], tomorrow: false };
  return { key: 'fajr', at: timesFor(addDays(now, 1)).fajr, tomorrow: true };
}
const hijriOf = d => C.hijri(d, S.hijriAdj);
function hijriNow(now) { let a = S.hijriAdj; if (S.hijriMaghrib && now >= timesFor(now).maghrib) a += 1; return C.hijri(now, a); }
function fastInfo(d) {
  const h = hijriOf(d), dow = d.getDay(), tags = [];
  const forbidden = (h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13), ramadan = h.m === 9;
  let season = null;
  if (ramadan) season = 'ramadan';
  else if (h.m === 8) season = 'fastShaban';
  else if (h.m === 10 && h.d >= 2) season = 'fastShawwal';
  if (!forbidden && !ramadan) {
    if (dow === 1) tags.push('fastMon'); if (dow === 4) tags.push('fastThu');
    if (h.d >= 13 && h.d <= 15) tags.push('fastWhite');
    if (h.m === 12 && h.d === 9) tags.push('fastArafah');
    if (h.m === 1 && (h.d === 9 || h.d === 10)) tags.push('fastAshura');
    if (h.m === 10 && h.d >= 2 && h.d <= 7) tags.push('fastShawwal');
  }
  return { forbidden, ramadan, tags, season };
}
function isFasting(d) { const fi = fastInfo(d); if (fi.forbidden) return false; return fi.ramadan || S.fasting[dkey(d)] === true; }
const hKey = h => h.y * 12 + h.m;
function hijriMonthStart(y, m) {
  const target = y * 12 + m, today = new Date(), h0 = hijriOf(today);
  let est = addDays(today, Math.round((target - hKey(h0)) * 29.53) - (h0.d - 1)), g = 0;
  while (hKey(hijriOf(est)) < target && g++ < 80) est = addDays(est, 1);
  while (hKey(hijriOf(est)) > target && g++ < 160) est = addDays(est, -1);
  while (hijriOf(est).d > 1 && hKey(hijriOf(est)) === target && g++ < 240) est = addDays(est, -1);
  return est;
}
const eventsOn = d => { const h = hijriOf(d); return D.EVENTS.filter(e => e[0] === h.m && e[1] === h.d).map(e => L(e[2])); };

/* ---------- state ---------- */
let mode = 'c', cur = 0, hover = false, ignoring = true, alertItem = null, playing = false;
let collapseT = 0, dwellT = 0, alertT = 0, lastSec = -1, lastDay = dkey(new Date()), calDirty = true;
let cal = null;
const isl = $('#isl');

function resetCal() { const h = hijriOf(new Date()); cal = { hy: h.y, hm: h.m }; calDirty = true; }
resetCal();

/* ---------- page builders ---------- */
function timeHTML(now) {
  const h = now.getHours(), hs = S.h24 ? pad(h) : String(h % 12 || 12);
  return nC(hs + ':' + pad(now.getMinutes())) + '<span class="s">' + nC(pad(now.getSeconds())) + '</span>' + (S.h24 ? '' : '<span class="p">' + period(h) + '</span>');
}
function pg0(now) {
  const n = NAMES[(now.getHours() * 60 + now.getMinutes()) % 99], np = nextPrayer(now);
  return '<div class="p0"><div class="l"><div class="big">' + timeHTML(now) + '</div><div class="dg">' + esc(fmtGreg(now, true)) + '</div><div class="dh">' + esc(fmtHijri(hijriNow(now))) + '</div></div>' +
    '<div class="r"><div class="nar">' + esc(n[1]) + '</div><div class="ntr">' + esc(n[0]) + '</div><div class="nmn">' + esc(S.lang === 'fr' ? n[3] : n[2]) + '</div></div>' +
    '<div class="foot"><span>' + esc(t('nextPrayerLbl')) + ' <b>' + esc(t(np.key)) + '</b> ' + (np.tomorrow ? esc(t('tomorrow')) + ' ' : '') + fmtHM(np.at) + '</span><span class="cd">' + dur(np.at - now) + '</span></div></div>';
}
function pg1(now) {
  const first = hijriMonthStart(cal.hy, cal.hm); let len = 0, d = first;
  while (len < 31 && hKey(hijriOf(d)) === cal.hy * 12 + cal.hm) { len++; d = addDays(d, 1); }
  const last = addDays(first, len - 1);
  const sub = D.MONTHS_G[S.lang][first.getMonth()] + (first.getMonth() !== last.getMonth() ? ' / ' + D.MONTHS_G[S.lang][last.getMonth()] : '') + ' ' + nA(last.getFullYear());
  let s = '<div class="pc"><div class="ch"><button class="nb" data-act="calPrev" aria-label="prev"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
    '<div class="t"><b>' + esc(D.MONTHS_H[S.lang][cal.hm - 1] + ' ' + nA(cal.hy) + ' ' + t('hijriShort')) + '</b><span>' + esc(sub) + '</span></div>' +
    '<button class="nb" data-act="calNext" aria-label="next"><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M15 6l-6 6 6 6"/></svg></button></div><div class="cg">';
  for (let i = 0; i < 7; i++) s += '<div class="h">' + esc(D.DAYS_S[S.lang][(S.weekStart + i) % 7]) + '</div>';
  const off = (first.getDay() - S.weekStart + 7) % 7;
  for (let i = 0; i < off; i++) s += '<div class="cc e"></div>';
  const evs = [];
  for (let i = 0; i < len; i++) {
    const dd = addDays(first, i), h = hijriOf(dd), ev = eventsOn(dd);
    if (ev.length) evs.push([dd, ev[0]]);
    s += '<div class="cc' + (sameDay(dd, now) ? ' t' : '') + (dd.getDay() === 5 ? ' f' : '') + (ev.length && !sameDay(dd, now) ? ' v' : '') + '"><b>' + nA(h.d) + '</b><em>' + nA(dd.getDate()) + '</em></div>';
  }
  s += '</div><div class="cf"><span><b>' + esc(fmtGreg(now, true)) + '</b></span><span>' + (evs.length ? esc(nA(evs[0][0].getDate()) + ' ' + D.MONTHS_G[S.lang][evs[0][0].getMonth()].slice(0, 3) + ': ' + evs[0][1]) : esc(t('noEvents'))) + '</span></div></div>';
  return s;
}
function pg2(now) {
  const tm = timesFor(now), np = nextPrayer(now);
  let s = '<div class="pp"><div class="pt">' + esc(t('timesTitle')) + ' · ' + esc(S.loc.name) + '</div><div class="pgrid">';
  ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
    const nx = !np.tomorrow && np.key === k;
    s += '<div class="tile' + (nx ? ' n' : (tm[k] < now ? ' p' : '')) + '"><small>' + esc(t(k)) + '</small><b>' + fmtHM(tm[k]) + '</b></div>';
  });
  s += '</div><div class="foot"><span>' + esc(t('nextPrayerLbl')) + ' <b>' + esc(t(np.key)) + '</b></span><span class="cd">' + dur(np.at - now) + '</span></div></div>';
  return s;
}
function pg3(now) {
  const fi = fastInfo(now), fasting = isFasting(now), tm = timesFor(now);
  let s = '<div class="pf"><div class="row"><div class="pt">' + esc(t('fastTitle')) + '</div>';
  if (!fi.forbidden && !fi.ramadan) s += '<button class="btn' + (fasting ? '' : ' pri') + '" data-act="toggleFast">' + esc(fasting ? t('cancel') : t('fastingToday')) + '</button>';
  s += '</div>';
  const tags = []; if (fi.ramadan) tags.push(t('ramadan')); fi.tags.forEach(k => tags.push(t(k)));
  if (fi.forbidden) s += '<div class="tag">' + esc(t('fastNo')) + '</div>';
  else {
    s += '<div class="ft"><div><small>' + esc(t('imsak')) + '</small><b>' + fmtHM(tm.imsak) + '</b></div><div><small>' + esc(t('iftar')) + '</small><b>' + fmtHM(tm.maghrib) + '</b></div></div>';
    if (fasting) {
      let lbl, ms, pct = 0;
      if (now < tm.imsak) { lbl = t('imsakIn'); ms = tm.imsak - now; }
      else if (now < tm.maghrib) { lbl = t('iftarIn'); ms = tm.maghrib - now; pct = Math.max(0, Math.min(100, (now - tm.fajr) / (tm.maghrib - tm.fajr) * 100)); }
      else { lbl = t('fastDone'); ms = 0; pct = 100; }
      s += '<div class="st"><span>' + esc(lbl) + '</span>' + (now < tm.maghrib ? '<span class="cd">' + dur(ms) + '</span>' : '') + '</div><div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
    } else s += '<div class="tag" style="color:var(--mut)">' + esc(t('notFasting')) + '</div>';
    if (tags.length) s += '<div class="tag">' + esc(t('sunnahFast')) + ': ' + esc(tags.join(' · ')) + '</div>';
  }
  return s + '</div>';
}
function pgAlert() {
  if (!alertItem) return '';
  const it = alertItem.it, dua = it.dua ? D.DUAS.find(d => d.id === it.dua) : null;
  return '<div class="al-h"><div><div class="al-t">' + esc(t('timeFor')) + '</div><div class="al-n">' + esc(itemLabel(it)) + ' · ' + fmtHM(alertItem.at) + '</div></div>' +
    (playing ? '<button class="btn pri" data-act="stop">' + esc(t('stop')) + '</button>' : '<button class="btn" data-act="dismiss">' + esc(t('close')) + '</button>') + '</div>' +
    (dua ? '<div class="al-d">' + esc(dua.ar) + '</div>' : (it.fast ? '<div class="al-d" style="font-family:var(--sans);font-size:14px;direction:inherit;color:var(--mut)">' + esc(t('fastAlertBody')) + '</div>' : ''));
}

/* ---------- render and state machine ---------- */
function renderActive() {
  const now = new Date();
  if (mode === 'al') { $('#pga').innerHTML = pgAlert(); return; }
  if (mode !== 'e') return;
  if (cur === 0) $('#pg0').innerHTML = pg0(now);
  else if (cur === 1) { if (calDirty) { $('#pg1').innerHTML = pg1(now); calDirty = false; } }
  else if (cur === 2) $('#pg2').innerHTML = pg2(now);
  else if (cur === 3) $('#pg3').innerHTML = pg3(now);
}
function apply() {
  isl.className = 'isl ' + (mode === 'c' ? 'c' : mode === 'al' ? 'al' : 'e e' + cur);
  $$('.pg').forEach(p => {
    const i = p.dataset.i;
    const on = mode === 'al' ? i === 'a' : (mode === 'e' && i === String(cur));
    p.classList.toggle('on', on);
    p.classList.toggle('up', !on && i !== 'a' && mode === 'e' && +i < cur);
  });
  $$('#dots i').forEach(d => d.classList.toggle('on', +d.dataset.d === cur));
  renderActive();
}
function expand(p) { mode = 'e'; cur = p || 0; apply(); }
function collapse() { mode = 'c'; alertItem = null; clearTimeout(alertT); cur = 0; resetCal(); apply(); }
function go(d) {
  if (mode !== 'e') return;
  const n = Math.max(0, Math.min(3, cur + d));
  if (n === cur) return;
  cur = n; if (cur === 1) { resetCal(); } apply();
}

/* ---------- hover detection ---------- */
function setIgnore(v) { if (ignoring === v) return; ignoring = v; if (desk) desk.ignore(v); }
function setHover(inside) {
  if (inside) {
    setIgnore(false); hover = true; clearTimeout(collapseT); collapseT = 0;
    if (mode === 'c' && !dwellT) dwellT = setTimeout(() => { dwellT = 0; if (hover && mode === 'c') expand(0); }, 140);
  } else {
    hover = false; clearTimeout(dwellT); dwellT = 0;
    setIgnore(true);
    if ((mode === 'e' || mode === 'al') && !collapseT) collapseT = setTimeout(() => { collapseT = 0; if (!hover && !(mode === 'al' && playing)) collapse(); }, 500);
  }
}
if (desk) {
  setInterval(async () => {
    try {
      const p = await desk.cursor();
      const r = isl.getBoundingClientRect(), pad4 = 5;
      setHover(p.x >= r.left - pad4 && p.x <= r.right + pad4 && p.y >= r.top - pad4 && p.y <= r.bottom + pad4);
    } catch (e) { /* ignore */ }
  }, 90);
} else {
  isl.addEventListener('mouseenter', () => setHover(true));
  isl.addEventListener('mouseleave', () => setHover(false));
}

/* wheel: scroll down or swipe up = next page */
let wAcc = 0, wLock = false, wIdle = 0;
isl.addEventListener('wheel', e => {
  if (mode !== 'e') return;
  e.preventDefault();
  wAcc += e.deltaY; clearTimeout(wIdle); wIdle = setTimeout(() => { wAcc = 0; }, 220);
  if (Math.abs(wAcc) >= 30 && !wLock) { go(wAcc > 0 ? 1 : -1); wAcc = 0; wLock = true; setTimeout(() => { wLock = false; }, 380); }
}, { passive: false });
/* drag up/down (mouse or touch) */
let dragY = null;
isl.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dragY = e.clientY; });
window.addEventListener('pointerup', e => {
  if (dragY == null) return;
  const dy = dragY - e.clientY; dragY = null;
  if (dy > 40) go(1); else if (dy < -40) go(-1);
});
/* keyboard (only used when focus is on the window, e.g. in a browser) */
window.addEventListener('keydown', e => { if (e.key === 'ArrowDown') go(1); else if (e.key === 'ArrowUp') go(-1); else if (e.key === 'Escape') collapse(); });

/* clicks */
isl.addEventListener('click', e => {
  const dot = e.target.closest('#dots i');
  if (dot) { cur = +dot.dataset.d; if (cur === 1) resetCal(); apply(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'calPrev' || a === 'calNext') {
    cal.hm += a === 'calNext' ? 1 : -1;
    if (cal.hm > 12) { cal.hm = 1; cal.hy++; } if (cal.hm < 1) { cal.hm = 12; cal.hy--; }
    calDirty = true; renderActive();
  } else if (a === 'toggleFast') {
    const k = dkey(new Date()), f = Object.assign({}, rawStore().fasting || {});
    if (f[k]) delete f[k]; else f[k] = true;
    patchStore({ fasting: f }); S.fasting = f; renderActive();
  } else if (a === 'stop') { stopSound(); collapse(); }
  else if (a === 'dismiss') { collapse(); }
});
isl.addEventListener('dblclick', e => { if (desk && !e.target.closest('button')) desk.openApp(); });

/* ---------- audio ---------- */
let actx = null, aud = null, adhanUrl = null;
function audioCtx() {
  if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (A) actx = new A(); }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function chime() {
  const c = audioCtx(); if (!c) return;
  const t0 = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
    const st = t0 + i * 0.45;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.22, st + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, st + 1.3);
    o.connect(g); g.connect(c.destination); o.start(st); o.stop(st + 1.4);
  });
}
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('asma', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function idbGet(k) { return idb().then(db => new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }
function bundledPick(it) {
  const k = it && it.key;
  if (k === 'fajr') return S.adhanFajr || '2';
  if (k === 'dhuhr' || k === 'asr') return S.adhanDhuhr || '3';
  if (k === 'maghrib' || k === 'isha') return S.adhanMaghrib || S.adhanOther || '1';
  return S.adhanFajr || '2';
}
function bundledSrc(it) {
  const n = bundledPick(it);
  return 'audio/adhan-' + (n === '2' || n === '3' ? n : '1') + '.m4a';
}
async function playSound(kind, it) {
  stopSound();
  if (S.sound === 'off') return;
  const mark = () => { playing = true; renderActive(); };
  if (kind !== 'adhan' || S.sound === 'chime') { chime(); return; }
  if (!aud) { aud = new Audio(); aud.onended = () => { playing = false; if (mode === 'al') renderActive(); }; }
  if (S.sound === 'file') {
    try {
      const b = await idbGet('adhan');
      if (b) {
        if (adhanUrl) URL.revokeObjectURL(adhanUrl);
        adhanUrl = URL.createObjectURL(b);
        aud.src = adhanUrl; await aud.play(); mark(); return;
      }
    } catch (e) { /* fall back to chime */ }
    chime();
    return;
  }
  try { aud.src = bundledSrc(it); await aud.play(); mark(); } catch (e) { chime(); }
}
function stopSound() { if (aud) { aud.pause(); aud.currentTime = 0; } playing = false; }

/* ---------- routine alerts ---------- */
const firedKeys = new Set();
let lastAlertCheck = Date.now();
function itemLabel(it) { return it.key ? t(it.key) : (it.name || L(it.label)); }
function itemTime(it, date) {
  if (it.fixed) { const p = it.fixed.split(':'); return new Date(date.getFullYear(), date.getMonth(), date.getDate(), +p[0] || 0, +p[1] || 0, 0); }
  const tm = timesFor(date)[it.ref]; return tm ? new Date(tm.getTime() + (it.off || 0) * 60000) : null;
}
function checkAlerts(now) {
  const from = Math.max(lastAlertCheck, now.getTime() - 90000), to = now.getTime();
  lastAlertCheck = to;
  const fasting = isFasting(now);
  S.routine.forEach(it => {
    if (!it.on || (it.fast && !fasting)) return;
    const at = itemTime(it, now); if (!at) return;
    const ms = at.getTime();
    if (ms > from && ms <= to) {
      const k = dkey(now) + '|' + it.id;
      if (firedKeys.has(k)) return;
      firedKeys.add(k); showAlert(it, at);
    }
  });
}
function showAlert(it, at) {
  alertItem = { it, at }; mode = 'al'; playing = false;
  if (desk) desk.show();
  apply(); playSound((it.adhan || !it.key) ? 'adhan' : 'chime', it);
  clearTimeout(alertT);
  const finish = () => { playing = false; if (mode === 'al' && !hover) collapse(); };
  if (aud) aud.onended = finish;
  alertT = setTimeout(() => { if (!hover) { stopSound(); collapse(); } }, 12 * 60 * 1000);
}

/* ---------- location and daily check ---------- */
function dailyCheck(force) {
  const now = new Date(), k = dkey(now);
  if (!force && S.lastCheck === k) return;
  patchStore({ lastCheck: k, checkedAt: now.getTime() }); S.lastCheck = k;
  tmCache = new Map(); firedKeys.clear();
  if (S.loc.auto && desk && desk.ipLocation) {
    desk.ipLocation().then(p => {
      if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
      const moved = C.distKm(p.lat, p.lng, S.loc.lat, S.loc.lng);
      if (moved > 25 || S.fresh) {
        let name = p.lat.toFixed(2) + ', ' + p.lng.toFixed(2), bd = 60;
        D.CITIES.forEach(c => { const d = C.distKm(p.lat, p.lng, c[1], c[2]); if (d < bd) { bd = d; name = c[0]; } });
        patchStore({ loc: { auto: true, lat: p.lat, lng: p.lng, name }, fresh: false });
        reloadStore();
      }
    }).catch(() => {});
  }
}
function reloadStore() { S = load(); tmCache = new Map(); applyLang(); calDirty = true; lastSec = -1; }
window.addEventListener('storage', e => { if (e.key === SKEY) reloadStore(); });
setInterval(() => { const a = JSON.stringify(rawStore()); if (a !== reloadStore.last) { reloadStore.last = a; reloadStore(); } }, 20000);

/* ---------- tick ---------- */
function tick(force) {
  const now = new Date(), sec = now.getSeconds();
  if (sec === lastSec && !force) return;
  lastSec = sec;
  const dk = dkey(now);
  if (dk !== lastDay) { lastDay = dk; dailyCheck(true); calDirty = true; }
  checkAlerts(now);
  const h = now.getHours(), hs = S.h24 ? pad(h) : String(h % 12 || 12);
  $('#ct').innerHTML = nC(hs + ':' + pad(now.getMinutes())) + '<small>' + nC(pad(sec)) + '</small>';
  if (mode === 'e') renderActive();
}

applyLang();
reloadStore.last = JSON.stringify(rawStore());
dailyCheck(false);
if (S.fresh && desk) dailyCheck(true);
apply();
tick(true);
setInterval(() => tick(false), 250);
if (desk) desk.ignore(true);

/* test hooks */
window.__island = { expand, collapse, go, fire: id => { const it = S.routine.find(x => x.id === id); if (it) showAlert(it, new Date()); }, state: () => ({ mode, cur }) };
})();
