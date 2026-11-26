/* Asma Clock: UI and behaviour */
(function () {
'use strict';

const D = window.AsmaData, C = window.AsmaCore, NAMES = window.NAMES;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* extra strings */
Object.assign(D.T.en, { secLbl: '(Seconds)', secUp: 'SECONDS', minName: 'Name of the minute', handName: 'Name under the hand', panelMode: 'Name shown below the dial', routineSub: 'Alerts play while the app is open', fastTag: 'Fasting day', jumuah: "Jumu'ah", family: 'Prayer' });
Object.assign(D.T.fr, { secLbl: '(Secondes)', secUp: 'SECONDES', minName: 'Nom de la minute', handName: "Nom sous l'aiguille", panelMode: 'Nom affiché sous le cadran', routineSub: "Les alertes sonnent quand l'application est ouverte", fastTag: 'Jour de jeûne', jumuah: 'Joumou’a', family: 'Prière' });
Object.assign(D.T.ar, { secLbl: '(الثواني)', secUp: 'الثواني', minName: 'اسم الدقيقة', handName: 'الاسم تحت العقرب', panelMode: 'الاسم المعروض تحت الساعة', routineSub: 'التنبيهات تعمل أثناء فتح التطبيق', fastTag: 'يوم صيام', jumuah: 'الجمعة', family: 'الصلاة' });

/* ---------- state ---------- */
const SKEY = 'asma.v1';
const APP_BUILD = 6;
const APP_NAME = '1.5';
const SITE_URL = 'https://asmaulhusnal.netlify.app/';
const UPDATE_URLS = [
  'https://raw.githubusercontent.com/dmaximboi/asmaulhusnal/main/web/version.json',
  'https://raw.githubusercontent.com/dmaximboi/asmaulhusnal/master/web/version.json'
];
const DEF = {
  lang: 'en', arClock: true, arAll: false, h24: false, method: 'MWL', asr: 1,
  adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  imsakMin: 10, hijriAdj: 0, hijriMaghrib: true, weekStart: 1,
  loc: { auto: true, lat: 5.36, lng: -4.0083, name: 'Abidjan' },
  notif: false, sound: 'bundled', adhanFajr: '2', adhanDhuhr: '3', adhanMaghrib: '1', wake: false, panel: 'minute',
  routine: null, fasting: {}, tab: 'clock', calMode: 'hijri', lastCheck: null, checkedAt: null, fresh: true
};
let S = load();
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { s = {}; }
  const o = Object.assign(clone(DEF), s);
  o.adj = Object.assign(clone(DEF.adj), s.adj || {});
  o.loc = Object.assign(clone(DEF.loc), s.loc || {});
  if (!Array.isArray(o.routine)) o.routine = clone(D.ROUTINE);
  if (!o.fasting || typeof o.fasting !== 'object') o.fasting = {};
  if (!s.adhanMaghrib && s.adhanOther) o.adhanMaghrib = s.adhanOther;
  if (!s.lang) { const nl = (navigator.language || 'en').slice(0, 2); if (nl === 'fr' || nl === 'ar') o.lang = nl; }
  return o;
}
let saveT = 0;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ }
    const pl = capPlugin('AsmaAlarms');
    if (pl && typeof pl.pushStore === 'function') pl.pushStore({ json: JSON.stringify(S) }).catch(() => {});
  }, 150);
}

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

function fmtHM(d, num) {
  if (!(d instanceof Date) || isNaN(d)) return t('noTime');
  const n = num || nA;
  let h = d.getHours();
  const m = pad(d.getMinutes());
  if (S.h24) return n(pad(h) + ':' + m);
  const p = period(h);
  h = h % 12 || 12;
  return n(h + ':' + m) + ' ' + p;
}
function fmtGreg(d, withDow) {
  return (withDow ? D.DAYS[S.lang][d.getDay()] + (S.lang === 'ar' ? '، ' : ', ') : '') + nA(d.getDate()) + ' ' + D.MONTHS_G[S.lang][d.getMonth()] + ' ' + nA(d.getFullYear());
}
function fmtHijri(h) {
  return nA(h.d) + ' ' + D.MONTHS_H[S.lang][h.m - 1] + ' ' + nA(h.y) + ' ' + t('hijriShort');
}
function dur(ms) { return nC(C.fmtDur(ms)); }

/* ---------- prayer times ---------- */
let tmCache = new Map();
function cfg() { return { lat: S.loc.lat, lng: S.loc.lng, method: S.method, asr: S.asr, adj: S.adj, imsakMin: S.imsakMin }; }
function timesFor(date) {
  const k = dkey(date);
  let v = tmCache.get(k);
  if (!v) { v = C.dayTimes(date.getFullYear(), date.getMonth() + 1, date.getDate(), cfg()); tmCache.set(k, v); }
  return v;
}
function invalidate() { tmCache = new Map(); firedKeys.clear(); }

function nextPrayer(now) {
  const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const today = timesFor(now);
  for (const k of keys) if (today[k] > now) return { key: k, at: today[k], tomorrow: false };
  const tm = timesFor(addDays(now, 1));
  return { key: 'fajr', at: tm.fajr, tomorrow: true };
}
function hijriNow(now) {
  let adj = S.hijriAdj;
  if (S.hijriMaghrib && now >= timesFor(now).maghrib) adj += 1;
  return C.hijri(now, adj);
}
const hijriOf = d => C.hijri(d, S.hijriAdj);

/* ---------- fasting ---------- */
function fastInfo(d) {
  const h = hijriOf(d), dow = d.getDay(), tags = [];
  const forbidden = (h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13);
  const ramadan = h.m === 9;
  let season = null;
  if (ramadan) season = 'ramadan';
  else if (h.m === 8) season = 'fastShaban';
  else if (h.m === 10 && h.d >= 2) season = 'fastShawwal';
  if (!forbidden && !ramadan) {
    if (dow === 1) tags.push('fastMon');
    if (dow === 4) tags.push('fastThu');
    if (h.d >= 13 && h.d <= 15) tags.push('fastWhite');
    if (h.m === 12 && h.d === 9) tags.push('fastArafah');
    if (h.m === 1 && (h.d === 9 || h.d === 10)) tags.push('fastAshura');
    if (h.m === 10 && h.d >= 2 && h.d <= 7) tags.push('fastShawwal');
  }
  return { forbidden, ramadan, tags, season };
}
function isFasting(d) {
  const fi = fastInfo(d);
  if (fi.forbidden) return false;
  return fi.ramadan || S.fasting[dkey(d)] === true;
}

function buildDial() {
  return window.AsmaDial ? window.AsmaDial.build() : '';
}

/* ---------- views ---------- */
const views = {};
let lastIdx = -1, lastSec = -1, lastMinKey = '', lastDay = dkey(new Date());
let cal = null;

function renderNavLabels() {
  const keys = ['tabClock', 'tabPrayer', 'tabCalendar', 'tabRoutine', 'tabDuas', 'tabLearn'];
  $$('#nav button').forEach((b, i) => { $('span', b).textContent = t(keys[i]); b.classList.toggle('on', b.dataset.tab === S.tab); });
  $('#brand').textContent = t('appName');
  $('#btnSettings').setAttribute('aria-label', t('settings'));
}

function renderClockView() {
  const el = $('#v-clock');
  el.innerHTML =
    '<div class="meta"><div><span class="sm">' + esc(t('dhikr')) + '</span><h1>' + esc(t('namesTitle')) + '</h1></div>' +
    '<div class="r"><span class="sm">' + esc(t('nameLbl')) + '</span><h1 id="cnt"></h1></div></div>' +
    '<div class="barrow"><div class="lbl"><span>' + esc(t('secLbl')) + '</span><b id="secv"></b></div><div class="segs" id="segs">' + '<i></i>'.repeat(10) + '</div></div>' +
    '<div class="dial" id="dial">' + buildDial() + '</div>' +
    '<div class="timeblock"><div class="tbig" id="tbig"></div><div class="dg" id="dg"></div><div class="dh" id="dh"></div></div>' +
    '<div class="namepanel" id="panel"><div class="ar" id="pAr"></div><div class="tr" id="pTr"></div><div class="mn" id="pMn"></div><div class="hint">' + esc(t('sayInHeart')) + '</div></div>' +
    '<div class="week" id="week"></div>' +
    '<div id="live"></div>';
  lastIdx = -1; lastSec = -1; lastMinKey = '';
  renderWeek();
  tick(true);
}

function renderWeek() {
  const el = $('#week'); if (!el) return;
  const now = new Date();
  const start = addDays(now, -((now.getDay() - S.weekStart + 7) % 7));
  let s = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i), h = hijriOf(d), fi = fastInfo(d);
    const sun = !fi.forbidden && (fi.tags.length || fi.ramadan);
    s += '<button class="wd' + (sameDay(d, now) ? ' today' : '') + '" data-act="gotoDay" data-date="' + dkey(d) + '">' +
      (sun ? '<span class="dot"></span>' : '') +
      '<span class="w">' + esc(D.DAYS_S[S.lang][d.getDay()]) + '</span><b>' + nA(d.getDate()) + '</b><em>' + nA(h.d) + '</em></button>';
  }
  el.innerHTML = s;
}

function setPanel(i, animate) {
  const n = NAMES[i], p = $('#panel');
  if (!p) return;
  $('#pAr').textContent = n[1];
  $('#pTr').textContent = n[0].toUpperCase();
  $('#pMn').textContent = S.lang === 'fr' ? n[3] : n[2];
  $('#cnt').textContent = nC(i + 1) + ' / ' + nC(99);
  if (animate) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); }
}

let loopsOn = false, tickId = 0, clockRaf = 0;
function frameOnce() {
  const dial = $('#dial');
  if (dial && S.tab === 'clock' && window.AsmaDial) {
    const idx = window.AsmaDial.frame(dial);
    if (idx >= 0 && idx !== lastIdx) {
      lastIdx = idx;
      if (S.panel === 'hand') setPanel(idx, true);
    }
  }
}
function startLoops() {
  if (loopsOn) return;
  loopsOn = true;
  if (!tickId) tickId = setInterval(() => tick(false), 250);
  const loop = () => {
    if (!loopsOn) return;
    frameOnce();
    clockRaf = requestAnimationFrame(loop);
  };
  clockRaf = requestAnimationFrame(loop);
}
function stopLoops() {
  loopsOn = false;
  if (tickId) { clearInterval(tickId); tickId = 0; }
  if (clockRaf) { cancelAnimationFrame(clockRaf); clockRaf = 0; }
}

function tick(force) {
  const now = new Date();
  const sec = now.getSeconds();
  if (sec === lastSec && !force) return;
  lastSec = sec;

  /* day rollover: daily recheck */
  const dk = dkey(now);
  if (dk !== lastDay) { lastDay = dk; dailyCheck(true); renderWeek(); if (S.tab !== 'clock') renderTab(S.tab); }

  checkAlerts(now);

  if (S.tab === 'clock' && $('#tbig')) {
    let h = now.getHours();
    const hs = S.h24 ? pad(h) : String(h % 12 || 12);
    $('#tbig').innerHTML = nC(hs + ':' + pad(now.getMinutes())) + '<span class="sec">' + nC(pad(sec)) + '</span>' + (S.h24 ? '' : '<span class="per">' + period(h) + '</span>');
    $('#dg').textContent = fmtGreg(now, true);
    $('#dh').textContent = fmtHijri(hijriNow(now));
    $('#secv').textContent = nC(sec) + ' / ' + nC(60);
    $$('#segs i').forEach((s, i) => s.classList.toggle('on', i < Math.ceil(sec / 6)));
    const mk = dk + now.getHours() + ':' + now.getMinutes();
    if (mk !== lastMinKey) {
      const first = lastMinKey === '';
      lastMinKey = mk;
      if (S.panel === 'minute') setPanel((now.getHours() * 60 + now.getMinutes()) % 99, !first);
    }
    renderLive(now);
  }
  if (S.tab === 'prayer') updatePrayerCountdown(now);
}

/* live cards under the clock */
function renderLive(now) {
  const el = $('#live'); if (!el) return;
  const np = nextPrayer(now), today = timesFor(now);
  let s = '<div class="card"><div class="nextcard"><div><span class="sm">' + esc(t('nextPrayerLbl')) + '</span><div class="pn">' + esc(t(np.key)) + '</div><div class="pt">' + (np.tomorrow ? esc(t('tomorrow')) + ' ' : '') + fmtHM(np.at) + '</div></div><div class="cd">' + dur(np.at - now) + '</div></div></div>';

  const fi = fastInfo(now), fasting = isFasting(now);
  s += '<div class="card fast"><div class="chead"><h3>' + esc(t('fastTitle')) + '</h3>';
  if (!fi.forbidden && !fi.ramadan) {
    s += '<button class="btn sm' + (fasting ? '' : ' pri') + '" data-act="toggleFast">' + esc(fasting ? t('cancel') : t('fastingToday')) + '</button>';
  }
  s += '</div>';
  if (fi.forbidden) {
    s += '<div class="tags">' + esc(t('fastNo')) + '</div>';
  } else {
    const tags = [];
    if (fi.ramadan) tags.push(t('ramadan'));
    fi.tags.forEach(k => tags.push(t(k)));
    if (fi.season === 'fastShaban' && !fi.ramadan) tags.push(t('fastShaban'));
    if (tags.length) s += '<div class="tags">' + esc(t('sunnahFast')) + ': ' + esc(tags.join(' · ')) + '</div>';
    if (fasting) {
      let lbl, ms, pct = 0;
      if (now < today.imsak) { lbl = t('imsakIn'); ms = today.imsak - now; }
      else if (now < today.maghrib) { lbl = t('iftarIn'); ms = today.maghrib - now; pct = Math.max(0, Math.min(100, (now - today.fajr) / (today.maghrib - today.fajr) * 100)); }
      else { lbl = t('fastDone'); ms = 0; pct = 100; }
      s += '<div class="times"><div><small>' + esc(t('imsak')) + '</small><b>' + fmtHM(today.imsak) + '</b></div><div><small>' + esc(t('iftar')) + '</small><b>' + fmtHM(today.maghrib) + '</b></div></div>';
      s += '<div class="st"><span>' + esc(lbl) + '</span>' + (now < today.maghrib ? '<b>' + dur(ms) + '</b>' : '') + '</div><div class="bar2"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
    } else if (!tags.length) {
      s += '<div class="tags" style="color:var(--mut)">' + esc(t('notFasting')) + '</div>';
    }
  }
  s += '</div>';
  el.innerHTML = s;
}

/* ---------- prayer view ---------- */
const RAK = { fajr: 2, dhuhr: 4, asr: 4, maghrib: 3, isha: 4 };
function renderPrayer() {
  const now = new Date(), tm = timesFor(now), np = nextPrayer(now);
  const y = timesFor(addDays(now, -1));
  const rows = [['imsak', 1], ['fajr'], ['sunrise', 1], ['duha', 1], ['dhuhr'], ['asr'], ['maghrib'], ['isha']];
  let s = '<div class="pagehead"><h2>' + esc(t('timesTitle')) + '</h2><p>' + esc(S.loc.name) + ' · ' + esc(fmtGreg(now, true)) + '</p></div>';
  s += '<div class="card"><div class="nextcard"><div><span class="sm">' + esc(t('nextPrayerLbl')) + '</span><div class="pn">' + esc(t(np.key)) + '</div></div><div class="cd" id="pcd">' + dur(np.at - now) + '</div></div></div>';
  rows.forEach(r => {
    const k = r[0], minor = r[1], isNext = !np.tomorrow && np.key === k;
    const past = tm[k] < now;
    const sub = RAK[k] ? nA(RAK[k]) + ' ' + t('rak') : (k === 'duha' ? t('rakDuha') : (k === 'imsak' ? t('suhoor') : ''));
    s += '<div class="row' + (minor ? ' minor' : '') + (isNext ? ' next' : '') + (past && !isNext ? ' past' : '') + '"><div><div class="rn">' + esc(t(k)) + (k === 'dhuhr' && now.getDay() === 5 ? ' · ' + esc(t('jumuah')) : '') + '</div>' + (sub ? '<div class="rs">' + esc(sub) + '</div>' : '') + '</div><div class="rt">' + fmtHM(tm[k]) + '</div></div>';
  });
  s += '<div class="sub">' + esc(t('otherTimes')) + '</div>';
  [['midnight', 'tonight'], ['tahajjud', 'tonight']].forEach(r => {
    s += '<div class="row minor"><div><div class="rn">' + esc(t(r[0])) + '</div></div><div class="rt">' + fmtHM(tm[r[0]]) + '</div></div>';
  });
  const dF = Math.round((tm.fajr - y.fajr) / 60000 - 1440), dM = Math.round((tm.maghrib - y.maghrib) / 60000 - 1440);
  const sg = x => (x > 0 ? '+' : x < 0 ? '−' : '') + nA(Math.abs(x));
  s += '<p class="note">' + esc(t('dailyCheck')) + ': ' + (S.checkedAt ? esc(t('checkedAt')) + ' ' + fmtHM(new Date(S.checkedAt)) : '') + '<br>' + esc(t('fajr')) + ' ' + sg(dF) + ' · ' + esc(t('maghrib')) + ' ' + sg(dM) + ' ' + esc(t('vsYesterday')) + '</p>';
  const q = C.qibla(S.loc.lat, S.loc.lng);
  s += '<div class="card"><div class="chead"><div><h3>' + esc(t('qibla')) + '</h3><div style="font-size:22px;font-weight:600">' + nA(Math.round(q)) + '° <span class="sm" style="display:inline">' + esc(t('fromNorth')) + '</span></div></div>' +
    '<svg viewBox="-50 -50 100 100" width="92" height="92" style="direction:ltr"><circle r="44" fill="none" stroke="#3a3a36" stroke-width="1.5"/><text y="-33" text-anchor="middle" font-size="9" fill="#8f8f8a" font-family="Arial">N</text><g transform="rotate(' + q.toFixed(1) + ')"><polygon points="0,-30 6,6 0,2 -6,6" fill="#d6df8c"/></g><circle r="3" fill="#141414" stroke="#d6df8c"/></svg></div></div>';
  $('#v-prayer').innerHTML = s;
}
function updatePrayerCountdown(now) {
  const el = $('#pcd'); if (!el) return;
  const np = nextPrayer(now);
  el.textContent = dur(np.at - now);
}

/* ---------- calendar ---------- */
function hKey(h) { return h.y * 12 + h.m; }
function hijriMonthStart(y, m) {
  const target = y * 12 + m, today = new Date(), h0 = hijriOf(today);
  let est = addDays(today, Math.round((target - hKey(h0)) * 29.53) - (h0.d - 1)), g = 0;
  while (hKey(hijriOf(est)) < target && g++ < 80) est = addDays(est, 1);
  while (hKey(hijriOf(est)) > target && g++ < 160) est = addDays(est, -1);
  while (hijriOf(est).d > 1 && hKey(hijriOf(est)) === target && g++ < 240) est = addDays(est, -1);
  return est;
}
function ensureCal() {
  if (cal) return;
  const now = new Date(), h = hijriOf(now);
  cal = { hy: h.y, hm: h.m, gy: now.getFullYear(), gm: now.getMonth(), sel: now };
}
function calShift(dir) {
  if (S.calMode === 'hijri') { cal.hm += dir; if (cal.hm > 12) { cal.hm = 1; cal.hy++; } if (cal.hm < 1) { cal.hm = 12; cal.hy--; } }
  else { cal.gm += dir; if (cal.gm > 11) { cal.gm = 0; cal.gy++; } if (cal.gm < 0) { cal.gm = 11; cal.gy--; } }
}
function eventsOn(d) {
  const h = hijriOf(d);
  return D.EVENTS.filter(e => e[0] === h.m && e[1] === h.d).map(e => L(e[2]));
}
function renderCalendar() {
  ensureCal();
  const now = new Date();
  let first, len, title, sub;
  if (S.calMode === 'hijri') {
    first = hijriMonthStart(cal.hy, cal.hm);
    len = 0; let d = first;
    while (len < 31 && hKey(hijriOf(d)) === cal.hy * 12 + cal.hm) { len++; d = addDays(d, 1); }
    const last = addDays(first, len - 1);
    title = D.MONTHS_H[S.lang][cal.hm - 1] + ' ' + nA(cal.hy) + ' ' + t('hijriShort');
    sub = D.MONTHS_G[S.lang][first.getMonth()] + (first.getMonth() !== last.getMonth() ? ' / ' + D.MONTHS_G[S.lang][last.getMonth()] : '') + ' ' + nA(last.getFullYear());
  } else {
    first = new Date(cal.gy, cal.gm, 1, 12);
    len = new Date(cal.gy, cal.gm + 1, 0).getDate();
    title = D.MONTHS_G[S.lang][cal.gm] + ' ' + nA(cal.gy);
    const h1 = hijriOf(first), h2 = hijriOf(addDays(first, len - 1));
    sub = D.MONTHS_H[S.lang][h1.m - 1] + (h1.m !== h2.m ? ' / ' + D.MONTHS_H[S.lang][h2.m - 1] : '') + ' ' + nA(h2.y) + ' ' + t('hijriShort');
  }
  let s = '<div class="chead" style="margin-top:14px"><div class="pagehead" style="margin:0"><h2>' + esc(t('tabCalendar')) + '</h2></div>' +
    '<div class="seg"><button data-act="calMode" data-mode="hijri" class="' + (S.calMode === 'hijri' ? 'on' : '') + '">' + esc(t('calHijri')) + '</button><button data-act="calMode" data-mode="greg" class="' + (S.calMode === 'greg' ? 'on' : '') + '">' + esc(t('calGreg')) + '</button></div></div>';
  s += '<div class="calnav"><button class="ib" data-act="calPrev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><div class="ct"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div><button class="ib" data-act="calNext" aria-label="Next"><svg class="fl" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button></div>';
  s += '<div class="grid">';
  for (let i = 0; i < 7; i++) s += '<div class="h">' + esc(D.DAYS_S[S.lang][(S.weekStart + i) % 7]) + '</div>';
  const off = (first.getDay() - S.weekStart + 7) % 7;
  for (let i = 0; i < off; i++) s += '<div class="cell empty"></div>';
  for (let i = 0; i < len; i++) {
    const d = addDays(first, i), h = hijriOf(d);
    const main = S.calMode === 'hijri' ? h.d : d.getDate(), small = S.calMode === 'hijri' ? d.getDate() : h.d;
    const ev = eventsOn(d).length, fiDay = fastInfo(d);
    const fastCls = fiDay.ramadan ? ' ram' : (fiDay.forbidden ? ' nofast' : (fiDay.tags.length ? ' sunfast' : ''));
    s += '<button class="cell' + fastCls + (sameDay(d, now) ? ' today' : '') + (sameDay(d, cal.sel) ? ' sel' : '') + (d.getDay() === 5 ? ' fri' : '') + '" data-act="calSel" data-date="' + dkey(d) + '">' +
      (ev ? '<span class="dot"></span>' : '') +
      ((fiDay.tags.length || fiDay.ramadan) && !fiDay.forbidden ? '<span class="fmark"></span>' : '') +
      '<b>' + nA(main) + '</b><em>' + nA(small) + '</em></button>';
  }
  s += '</div>';
  s += '<p class="note">' + esc(t('calFastHint')) + '</p>';
  s += '<div class="calkey"><span><i class="k sun"></i>' + esc(t('fastMark')) + '</span><span><i class="k ram"></i>' + esc(t('fastRamMark')) + '</span><span><i class="k no"></i>' + esc(t('fastNoMark')) + '</span></div>';

  /* selected day */
  const sd = cal.sel, sh = hijriOf(sd), st = timesFor(sd), fi = fastInfo(sd);
  s += '<div class="card"><h3>' + esc(t('dayDetails')) + '</h3><div class="dayhd"><b>' + esc(fmtGreg(sd, true)) + '</b><span>' + esc(fmtHijri(sh)) + '</span></div>';
  const evs = eventsOn(sd);
  evs.forEach(e => { s += '<div class="note" style="color:var(--acc)">' + esc(e) + '</div>'; });
  const tg = [];
  if (fi.ramadan) tg.push(t('ramadan'));
  fi.tags.forEach(k => tg.push(t(k)));
  if (fi.season === 'fastShaban' && !fi.ramadan) tg.push(t('fastShaban'));
  if (fi.season === 'fastShawwal' && fi.tags.indexOf('fastShawwal') < 0) tg.push(t('fastShawwal'));
  if (fi.forbidden) s += '<div class="note">' + esc(t('fastNo')) + '</div>';
  else if (tg.length) s += '<div class="note">' + esc((fi.ramadan ? '' : t('sunnahFast') + ': ') + tg.join(' · ')) + '</div>';
  s += '<div class="ptg">';
  ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => { s += '<div><span>' + esc(t(k)) + '</span><b>' + fmtHM(st[k]) + '</b></div>'; });
  s += '</div></div>';

  /* month events */
  const list = [];
  for (let i = 0; i < len; i++) { const d = addDays(first, i); eventsOn(d).forEach(e => list.push([d, e])); }
  const monthH = S.calMode === 'hijri' ? cal.hm : hijriOf(first).m;
  if (monthH === 8) list.unshift([first, t('fastShabanNote')]);
  if (monthH === 9) list.unshift([first, t('ramadan')]);
  if (monthH === 10) list.unshift([addDays(first, 1), t('fastShawwalNote')]);
  s += '<div class="card"><h3>' + esc(t('monthEvents')) + '</h3>';
  if (!list.length) s += '<div class="note" style="margin:0">' + esc(t('noEvents')) + '</div>';
  list.forEach(x => { s += '<div class="evl"><span>' + nA(x[0].getDate()) + ' ' + esc(D.MONTHS_G[S.lang][x[0].getMonth()].slice(0, 3)) + '</span><div>' + esc(x[1]) + '</div></div>'; });
  s += '</div>';
  $('#v-calendar').innerHTML = s;
}

/* ---------- routine ---------- */
function itemLabel(it) { return it.key ? t(it.key) : (it.name || L(it.label)); }
function itemTime(it, date) {
  if (it.fixed) {
    const p = it.fixed.split(':');
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), +p[0] || 0, +p[1] || 0, 0);
  }
  const tm = timesFor(date)[it.ref];
  if (!tm) return null;
  return new Date(tm.getTime() + (it.off || 0) * 60000);
}
function itemSub(it) {
  const bits = [];
  if (it.fixed) bits.push(nA(it.fixed));
  else { const o = it.off || 0; if (o || !it.key) bits.push(t(it.ref) + (o ? ' ' + (o > 0 ? '+' : '−') + nA(Math.abs(o)) + ' ' + t('minShort') : '')); }
  if (it.fast) bits.push(t('fastTag'));
  return bits.join(' · ');
}
function renderRoutine() {
  const now = new Date();
  const items = S.routine.map(it => ({ it, at: itemTime(it, now) })).filter(x => x.at).sort((a, b) => a.at - b.at);
  const nextId = (items.find(x => x.at > now && x.it.on) || {}).it;
  let s = '<div class="pagehead"><h2>' + esc(t('routineTitle')) + '</h2><p>' + esc(capPlugin('AsmaAlarms') ? t('androidRoutineSub') : t('routineSub')) + '</p></div>';
  items.forEach(x => {
    const it = x.it;
    s += '<div class="row' + (nextId === it ? ' next' : '') + (x.at < now ? ' past' : '') + '"><button style="flex:1;text-align:start" data-act="rtEdit" data-id="' + esc(it.id) + '"><div class="rn">' + esc(itemLabel(it)) + '</div><div class="rs">' + esc(itemSub(it)) + '</div></button>' +
      '<div class="rt">' + fmtHM(x.at) + '</div><label class="sw"><input type="checkbox" data-rton="' + esc(it.id) + '"' + (it.on ? ' checked' : '') + '><i></i></label></div>';
  });
  s += '<div class="btns"><button class="btn pri" data-act="rtAdd">' + esc(t('addItem')) + '</button><button class="btn" data-act="rtReset">' + esc(t('resetRoutine')) + '</button></div>';
  $('#v-routine').innerHTML = s;
}
function openRoutineEditor(id) {
  const isNew = !id;
  const it = isNew ? { id: 'c' + Date.now(), name: '', fixed: '06:00', on: true, adhan: true } : S.routine.find(x => x.id === id);
  if (!it) return;
  const fixedMode = !!it.fixed;
  const pr = ['imsak', 'fajr', 'sunrise', 'duha', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight', 'tahajjud'];
  const duaOpts = '<option value="">-</option>' + D.DUAS.map(d => '<option value="' + d.id + '"' + (it.dua === d.id ? ' selected' : '') + '>' + esc(L(d.title)) + '</option>').join('');
  let s = '<div class="sh"><h2>' + esc(isNew ? t('addItem') : t('editItem')) + '</h2><button class="ib" data-act="closeSheet" aria-label="' + esc(t('close')) + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  s += '<form id="rtForm" data-id="' + esc(it.id) + '" data-new="' + (isNew ? 1 : 0) + '">';
  s += '<label class="field"><span>' + esc(t('itemName')) + '</span><input type="text" name="name" value="' + esc(it.key ? t(it.key) : (it.name || L(it.label))) + '" maxlength="60"></label>';
  s += '<label class="field"><span>' + esc(t('anchorType')) + '</span><select name="mode"><option value="fixed"' + (fixedMode ? ' selected' : '') + '>' + esc(t('anchorFixed')) + '</option><option value="prayer"' + (!fixedMode ? ' selected' : '') + '>' + esc(t('anchorPrayer')) + '</option></select></label>';
  s += '<label class="field" data-m="fixed"><span>' + esc(t('fixedTime')) + '</span><input type="time" name="fixed" value="' + esc(it.fixed || '06:00') + '"></label>';
  s += '<label class="field" data-m="prayer"><span>' + esc(t('anchorRef')) + '</span><select name="ref">' + pr.map(k => '<option value="' + k + '"' + (it.ref === k ? ' selected' : '') + '>' + esc(t(k)) + '</option>').join('') + '</select></label>';
  s += '<label class="field" data-m="prayer"><span>' + esc(t('offsetMin')) + '</span><input type="number" name="off" value="' + (it.off || 0) + '" step="1" min="-600" max="600"></label>';
  s += '<label class="field"><span>' + esc(t('dua')) + '</span><select name="dua">' + duaOpts + '</select></label>';
  s += '<div class="set"><div class="r"><span>' + esc(t('fastOnly')) + '</span><label class="sw"><input type="checkbox" name="fast"' + (it.fast ? ' checked' : '') + '><i></i></label></div><div class="r"><span>' + esc(t('alertLbl')) + '</span><label class="sw"><input type="checkbox" name="on"' + (it.on ? ' checked' : '') + '><i></i></label></div></div>';
  s += '<div class="btns"><button type="submit" class="btn pri">' + esc(t('save')) + '</button><button type="button" class="btn" data-act="closeSheet">' + esc(t('cancel')) + '</button>' + (isNew ? '' : '<button type="button" class="btn danger" data-act="rtDel" data-id="' + esc(it.id) + '">' + esc(t('del')) + '</button>') + '</div></form>';
  openSheet(s);
  const form = $('#rtForm');
  const sync = () => $$('[data-m]', form).forEach(f => { f.hidden = f.dataset.m !== form.mode.value; });
  form.mode.addEventListener('change', sync); sync();
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = form, target = isNew ? it : S.routine.find(x => x.id === it.id);
    const nm = f.name.value.trim();
    if (it.key && nm === t(it.key)) { /* keep built-in label */ } else { delete target.key; target.name = nm || 'Reminder'; delete target.label; }
    if (f.mode.value === 'fixed') { target.fixed = f.fixed.value || '06:00'; delete target.ref; delete target.off; }
    else { target.ref = f.ref.value; target.off = parseInt(f.off.value, 10) || 0; delete target.fixed; }
    target.dua = f.dua.value || undefined; target.fast = f.fast.checked || undefined; target.on = f.on.checked;
    if (target.on) target.adhan = true;
    if (isNew) S.routine.push(target);
    save(); firedKeys.clear(); closeSheet(); renderRoutine();
  });
}

/* ---------- duas and names ---------- */
let duaTab = 'duas', nameQ = '', duaCat = 'all', duaQ = '';
const duaY = {};
const ISSUE_NEW = 'https://github.com/dmaximboi/asmaulhusnal/issues/new';
function issueUrl(title, body) {
  return ISSUE_NEW + '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
}
function duaCard(d) {
  return '<div class="card dua"><div class="tt">' + esc(L(d.title)) + '</div><div class="a">' + esc(d.ar) + '</div>' +
    (d.tr ? '<div class="tl">' + esc(d.tr) + '</div>' : '') +
    '<div class="tx">' + esc(S.lang === 'fr' ? d.fr : d.en) + '</div>' +
    (S.lang !== 'en' && S.lang !== 'fr' ? '<div class="tx f">' + esc(d.en) + '</div>' : '') +
    (d.note ? '<div class="nt">' + esc(L(d.note)) + '</div>' : '') +
    '<div class="sr">' + esc(t('source')) + ': ' + esc(d.src) + '</div></div>';
}
function duaCatLabel() {
  return duaCat === 'all' ? t('duasAll') : t(D.CAT_KEY[duaCat] || 'duasAll');
}
function setDuaSide(open) {
  const side = $('#duaSide'), mask = $('#duaMask');
  if (!side || !mask) return;
  mask.hidden = !open;
  side.hidden = !open;
  side.classList.toggle('on', !!open);
}
function renderDuas() {
  let s = '<div class="chead" style="margin-top:14px"><div class="pagehead" style="margin:0"><h2>' + esc(t('duasTab')) + '</h2></div><div class="seg"><button data-act="duaTab" data-v="duas" class="' + (duaTab === 'duas' ? 'on' : '') + '">' + esc(t('duasTab')) + '</button><button data-act="duaTab" data-v="names" class="' + (duaTab === 'names' ? 'on' : '') + '">' + esc(t('namesTab')) + '</button></div></div>';
  if (duaTab === 'duas') {
    s += '<div class="dua-sticky"><div class="dua-tools">';
    s += '<input class="search" id="duaQ" type="search" placeholder="' + esc(t('searchDuas')) + '" value="' + esc(duaQ) + '">';
    s += '<button class="btn sm" data-act="duaSide" aria-label="' + esc(t('duaCats')) + '">' + esc(t('duaCats')) + '</button>';
    s += '</div><p class="note" style="margin:8px 2px 0">' + esc(duaCatLabel()) + '</p></div>';
    s += '<div class="dua-mask" id="duaMask" data-act="duaSideClose" hidden></div>';
    s += '<aside class="dua-side" id="duaSide" hidden>';
    s += '<div class="sh"><h2>' + esc(t('duaCats')) + '</h2><button class="ib" data-act="duaSideClose" aria-label="' + esc(t('duaCatsClose')) + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    s += '<button class="cat' + (duaCat === 'all' ? ' on' : '') + '" data-act="duaCat" data-c="all">' + esc(t('duasAll')) + '</button>';
    D.CATS.forEach(c => {
      if (!D.DUAS.some(d => d.cat === c)) return;
      s += '<button class="cat' + (duaCat === c ? ' on' : '') + '" data-act="duaCat" data-c="' + c + '">' + esc(t(D.CAT_KEY[c])) + '</button>';
    });
    s += '</aside>';
    const q = duaQ.trim().toLowerCase();
    D.CATS.forEach(c => {
      if (duaCat !== 'all' && duaCat !== c) return;
      const list = D.DUAS.filter(d => d.cat === c && (!q || [d.ar, d.tr || '', d.en, d.fr, L(d.title), d.src].join(' ').toLowerCase().includes(q)));
      if (!list.length) return;
      s += '<div class="sub">' + esc(t(D.CAT_KEY[c])) + '</div>';
      list.forEach(d => { s += duaCard(d); });
    });
  } else {
    s += '<input class="search" id="nameQ" type="search" placeholder="' + esc(t('searchNames')) + '" value="' + esc(nameQ) + '"><div class="card" id="nameList"></div>';
  }
  $('#v-duas').innerHTML = s;
  if (duaTab === 'names') { renderNameList(); $('#nameQ').addEventListener('input', e => { nameQ = e.target.value; renderNameList(); }); }
  const dq = $('#duaQ');
  if (dq) dq.addEventListener('input', e => {
    duaQ = e.target.value;
    const pos = e.target.selectionStart;
    duaY[duaCat] = window.scrollY;
    renderDuas();
    const n = $('#duaQ');
    if (n) { n.focus(); if (typeof n.setSelectionRange === 'function') n.setSelectionRange(pos, pos); }
  });
  window.scrollTo(0, duaY[duaCat] || 0);
}
function renderNameList() {
  const q = nameQ.trim().toLowerCase();
  let s = '';
  NAMES.forEach((n, i) => {
    if (q && ![n[0], n[1], n[2], n[3], String(i + 1)].join(' ').toLowerCase().includes(q)) return;
    s += '<div class="nrow"><span class="n">' + nA(i + 1) + '</span><div class="t"><b>' + esc(n[0]) + '</b><span>' + esc(S.lang === 'fr' ? n[3] : n[2]) + '</span></div><span class="a">' + esc(n[1]) + '</span></div>';
  });
  $('#nameList').innerHTML = s || '<div class="note" style="margin:0">-</div>';
}

/* ---------- learn ---------- */
let learnTab = 'salah', dictQ = '', dictLetter = '', dictWords = null, rootEntries = null;
const accOpen = { wudu: true, tayammum: false, salah: false, mistakes: false, whatif: false };
const accSlide = { wudu: 0, tayammum: 0, salah: 0, mistakes: 0, whatif: 0 };
function learnNavHtml() {
  return '<div class="dua-sticky"><div class="seg learn-tabs">' +
    '<button data-act="learnTab" data-v="salah" class="' + (learnTab === 'salah' ? 'on' : '') + '">' + esc(t('learnNavSalah')) + '</button>' +
    '<button data-act="learnTab" data-v="dict" class="' + (learnTab === 'dict' ? 'on' : '') + '">' + esc(t('learnNavDict')) + '</button>' +
    '<button data-act="learnTab" data-v="root" class="' + (learnTab === 'root' ? 'on' : '') + '">' + esc(t('learnNavRoot')) + '</button>' +
    '</div></div>';
}
function renderSalahSlide(st) {
  let s = '<div class="acc-slide dua">';
  s += '<span class="num">' + nA(st.n) + '</span>';
  if (st.level === 'fard') s += '<span class="tag">' + esc(t('learnLevelFard')) + '</span>';
  if (st.level === 'sunnah') s += '<span class="tag">' + esc(t('learnLevelSunnah')) + '</span>';
  if (st.neglect) s += '<span class="tag">' + esc(t('learnNeglect')) + '</span>';
  s += '<div class="tt">' + esc(L(st.title)) + '</div>';
  s += '<p class="tx">' + esc(L(st.act)) + '</p>';
  if (st.say) {
    s += '<div class="a">' + esc(st.say.ar) + '</div>';
    if (st.say.tr) s += '<div class="tl">' + esc(st.say.tr) + '</div>';
    s += '<div class="tx">' + esc(S.lang === 'fr' ? st.say.fr : st.say.en) + '</div>';
    if (S.lang === 'ar') s += '<div class="tx f">' + esc(st.say.en) + '</div>';
  }
  if (st.src) s += '<div class="sr">' + esc(t('source')) + ': ' + esc(st.src) + '</div>';
  s += '</div>';
  return s;
}
function renderSalahLearn() {
  const sections = (window.AsmaSalah && window.AsmaSalah.SECTIONS) || [];
  let s = '<div class="pagehead"><h2>' + esc(t('learnSalahTitle')) + '</h2><p>' + esc(t('learnSalahSub')) + '</p></div>';
  sections.forEach(sec => {
    const slides = sec.slides || [];
    const open = !!accOpen[sec.id];
    let i = accSlide[sec.id] || 0;
    if (i < 0) i = 0;
    if (i >= slides.length) i = Math.max(0, slides.length - 1);
    accSlide[sec.id] = i;
    const st = slides[i];
    s += '<div class="acc' + (open ? ' open' : '') + '">';
    s += '<button class="acc-head" data-act="accToggle" data-id="' + sec.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">';
    s += '<b>' + esc(t(sec.titleKey)) + '</b><em>' + nA(slides.length) + '</em>';
    s += '<svg class="ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
    if (open && st) {
      s += '<div class="acc-body">';
      s += '<div class="acc-track" data-id="' + sec.id + '">' + renderSalahSlide(st) + '</div>';
      s += '<div class="acc-nav">';
      s += '<button class="btn sm" data-act="accGo" data-id="' + sec.id + '" data-d="-1"' + (i <= 0 ? ' disabled' : '') + '>' + esc(t('learnAccPrev')) + '</button>';
      s += '<span class="acc-pos">' + nA(i + 1) + esc(t('learnAccOf')) + nA(slides.length) + '</span>';
      s += '<button class="btn sm" data-act="accGo" data-id="' + sec.id + '" data-d="1"' + (i >= slides.length - 1 ? ' disabled' : '') + '>' + esc(t('learnAccNext')) + '</button>';
      s += '</div></div>';
    }
    s += '</div>';
  });
  return s;
}
function accGo(id, d) {
  const sec = ((window.AsmaSalah && window.AsmaSalah.SECTIONS) || []).find(x => x.id === id);
  if (!sec) return;
  const n = (sec.slides || []).length;
  accSlide[id] = Math.max(0, Math.min(n - 1, (accSlide[id] || 0) + d));
  const y = window.scrollY;
  renderLearn();
  window.scrollTo(0, y);
}
function bindAccSwipe() {
  $$('.acc-track').forEach(track => {
    let x0 = 0, y0 = 0, on = false;
    track.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      on = true;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    track.addEventListener('touchend', e => {
      if (!on) return;
      on = false;
      const p = e.changedTouches && e.changedTouches[0];
      if (!p) return;
      const dx = p.clientX - x0, dy = p.clientY - y0;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      const rtl = document.documentElement.getAttribute('dir') === 'rtl';
      accGo(track.dataset.id, (dx < 0) === !rtl ? 1 : -1);
    }, { passive: true });
  });
}
function dictLetterOf(w) {
  const r = String((w && w.root) || '').replace(/\s+/g, '');
  let ch = r.charAt(0);
  if ('أإآٱ'.indexOf(ch) >= 0) ch = 'ا';
  return ch;
}
function renderDictLearn() {
  let s = '<div class="pagehead"><h2>' + esc(t('learnDictTitle')) + '</h2><p>' + esc(t('learnDictHint')) + '</p></div>';
  const words = dictWords || [];
  if (words.length) s += '<p class="note">' + esc(t('learnDictCount').replace('%n', nA(words.length))) + '</p>';
  s += '<input class="search" id="dictQ" type="search" placeholder="' + esc(t('learnDictSearch')) + '" value="' + esc(dictQ) + '">';
  const order = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
  const have = {};
  words.forEach(w => { const Ltr = dictLetterOf(w); if (Ltr) have[Ltr] = true; });
  const letters = order.split('').filter(ch => have[ch]);
  if (letters.length) {
    s += '<div class="dict-letters">';
    s += '<button type="button" class="' + (!dictLetter ? 'on' : '') + '" data-act="dictLetter" data-l="">' + esc(t('learnDictAll')) + '</button>';
    letters.forEach(ch => {
      s += '<button type="button" class="' + (dictLetter === ch ? 'on' : '') + '" data-act="dictLetter" data-l="' + ch + '">' + ch + '</button>';
    });
    s += '</div>';
  }
  const q = dictQ.trim().toLowerCase();
  const shown = words.filter(w => {
    if (dictLetter && dictLetterOf(w) !== dictLetter) return false;
    if (!q) return true;
    return [w.ar, w.tr, w.root, w.en, w.fr, w.src].join(' ').toLowerCase().indexOf(q) !== -1;
  });
  if (!words.length) s += '<p class="note">' + esc(t('learnDictEmpty')) + '</p>';
  shown.forEach(w => {
    s += '<div class="card dua dict-card">';
    s += '<div class="a">' + esc(w.ar || '') + '</div>';
    if (w.tr) s += '<div class="tl">' + esc(w.tr) + '</div>';
    if (w.root) s += '<div class="tag">' + esc(t('learnDictRoot')) + ': ' + esc(w.root) + '</div>';
    s += '<p class="tx">' + esc(S.lang === 'fr' ? (w.fr || w.en || '') : (w.en || '')) + '</p>';
    if (S.lang === 'ar' && w.en) s += '<p class="tx f">' + esc(w.en) + '</p>';
    if (w.src) s += '<div class="sr">' + esc(t('source')) + ': ' + esc(w.src) + '</div>';
    s += '<button type="button" class="btn sm dict-rep" data-act="reportDict" data-ar="' + esc(w.ar || '') + '">' + esc(t('learnDictReport')) + '</button>';
    s += '</div>';
  });
  return s;
}
function renderRootLearn() {
  let s = '<div class="pagehead"><h2>' + esc(t('learnRootTitle')) + '</h2><p>' + esc(t('learnRootHint')) + '</p></div>';
  const list = rootEntries || [];
  if (!list.length) s += '<p class="note">' + esc(t('learnRootEmpty')) + '</p>';
  list.forEach(r => {
    s += '<div class="card dua"><div class="tt">' + esc(r.letters || '') + '</div>';
    if (r.ar) s += '<div class="a">' + esc(r.ar) + '</div>';
    s += '<div class="tx">' + esc(L(r.body) || r.en || '') + '</div>';
    if (r.src) s += '<div class="sr">' + esc(t('source')) + ': ' + esc(r.src) + '</div>';
    s += '</div>';
  });
  return s;
}
function renderLearn() {
  let s = learnNavHtml();
  if (learnTab === 'dict') s += renderDictLearn();
  else if (learnTab === 'root') s += renderRootLearn();
  else s += renderSalahLearn();
  $('#v-learn').innerHTML = s;
  if (learnTab === 'salah') bindAccSwipe();
  const dq = $('#dictQ');
  if (dq) dq.addEventListener('input', e => { dictQ = e.target.value; renderLearn(); const n = $('#dictQ'); if (n) { n.focus(); if (typeof n.setSelectionRange === 'function') n.setSelectionRange(n.value.length, n.value.length); } });
  if (learnTab === 'dict' && dictWords === null) {
    fetch('content/dict.json').then(r => r.ok ? r.json() : { words: [] }).then(j => { dictWords = (j && j.words) || []; renderLearn(); }).catch(() => { dictWords = []; renderLearn(); });
  }
  if (learnTab === 'root' && rootEntries === null) {
    fetch('content/roots.json').then(r => r.ok ? r.json() : { entries: [] }).then(j => { rootEntries = (j && j.entries) || []; renderLearn(); }).catch(() => { rootEntries = []; renderLearn(); });
  }
}

/* ---------- settings ---------- */
function stepper(path, val, min, max) {
  return '<span class="step"><button data-step="' + path + '" data-d="-1" data-min="' + min + '" data-max="' + max + '" aria-label="-">−</button><b>' + nA(val) + '</b><button data-step="' + path + '" data-d="1" data-min="' + min + '" data-max="' + max + '" aria-label="+">+</button></span>';
}
function toggle(path, on, dis) { return '<label class="sw"><input type="checkbox" data-set="' + path + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><i></i></label>'; }
function select(path, val, opts) { return '<select data-set="' + path + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>'; }

function renderSettings() {
  const prev = $('#sheet').scrollTop;
  const nativeAlarms = !!capPlugin('AsmaAlarms');
  const notifSupported = nativeAlarms || 'Notification' in window;
  const perm = nativeAlarms ? (S.notif ? 'granted' : 'default') : (notifSupported ? Notification.permission : 'denied');
  const notifOn = nativeAlarms ? !!S.notif : !!(S.notif && perm === 'granted');
  const notifDis = nativeAlarms ? false : (!notifSupported || perm === 'denied');
  const listed = D.CITIES.some(c => c[0] === S.loc.name);
  const cityOpts = [['__auto', t('locAuto')]];
  if (!S.loc.auto && !listed) cityOpts.push(['__custom', S.loc.name || t('locCustom')]);
  D.CITIES.forEach(c => cityOpts.push([c[0], c[0]]));
  const curCity = S.loc.auto ? '__auto' : (listed ? S.loc.name : '__custom');
  let s = '<div class="sh"><h2>' + esc(t('settings')) + '</h2><button class="ib" data-act="closeSheet" aria-label="' + esc(t('close')) + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';

  s += '<div class="set"><div class="st">' + esc(t('setLanguage')) + '</div>' +
    '<div class="r"><span>' + esc(t('setLanguage')) + '</span>' + select('lang', S.lang, [['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']]) + '</div>' +
    '<div class="r"><span>' + esc(t('setClockNum')) + '</span>' + toggle('arClock', S.arClock) + '</div>' +
    '<div class="r"><span>' + esc(t('setAllNum')) + '</span>' + toggle('arAll', S.arAll) + '</div>' +
    '<div class="r"><span>' + esc(t('setHour24')) + '</span>' + toggle('h24', S.h24) + '</div>' +
    '<div class="r"><span>' + esc(t('panelMode')) + '</span>' + select('panel', S.panel, [['minute', t('minName')], ['hand', t('handName')]]) + '</div>' +
    '<div class="r"><span>' + esc(t('setWeekStart')) + '</span>' + select('weekStart', S.weekStart, [[6, D.DAYS[S.lang][6]], [0, D.DAYS[S.lang][0]], [1, D.DAYS[S.lang][1]]]) + '</div></div>';

  s += '<div class="set"><div class="st">' + esc(t('setLocation')) + '</div>' +
    '<div class="r"><span>' + esc(S.loc.name) + '<small>' + nA(S.loc.lat.toFixed(3)) + ', ' + nA(S.loc.lng.toFixed(3)) + '</small></span><button class="btn sm" data-act="locUpdate">' + esc(t('locUpdate')) + '</button></div>' +
    '<div class="r"><span>' + esc(t('locManual')) + '</span>' + select('city', curCity, cityOpts) + '</div>' +
    '<label class="field"><span>' + esc(t('latLbl')) + '</span><input type="number" id="locLat" step="0.0001" min="-90" max="90" value="' + S.loc.lat + '"></label>' +
    '<label class="field"><span>' + esc(t('lngLbl')) + '</span><input type="number" id="locLng" step="0.0001" min="-180" max="180" value="' + S.loc.lng + '"></label>' +
    '<label class="field"><span>' + esc(t('locName')) + '</span><input type="text" id="locName" maxlength="60" value="' + esc(S.loc.auto ? '' : S.loc.name) + '"></label>' +
    '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="locApply">' + esc(t('locApply')) + '</button></div></div>';

  s += '<div class="set"><div class="st">' + esc(t('timesTitle')) + '</div>' +
    '<div class="r"><span>' + esc(t('setMethod')) + '</span>' + select('method', S.method, [['MWL', 'Muslim World League'], ['UOIF', 'UOIF (France)'], ['EGYPT', 'Egyptian Authority'], ['KARACHI', 'Karachi'], ['ISNA', 'ISNA'], ['UMM', 'Umm al-Qura']]) + '</div>' +
    '<div class="r"><span>' + esc(t('setAsr')) + '</span>' + select('asr', S.asr, [[1, t('asrStd')], [2, t('asrHanafi')]]) + '</div>' +
    '<div class="r"><span>' + esc(t('setImsak')) + '</span>' + stepper('imsakMin', S.imsakMin, 0, 60) + '</div>';
  ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => { s += '<div class="r"><span>' + esc(t(k)) + ' <small>' + esc(t('setAdjust')) + '</small></span>' + stepper('adj.' + k, S.adj[k], -30, 30) + '</div>'; });
  s += '<div class="r"><span>' + esc(t('setHijriAdj')) + '</span>' + stepper('hijriAdj', S.hijriAdj, -2, 2) + '</div>' +
    '<div class="r"><span>' + esc(t('setHijriMaghrib')) + '</span>' + toggle('hijriMaghrib', S.hijriMaghrib) + '</div></div>';

  s += '<div class="set"><div class="st">' + esc(t('setNotif')) + '</div>' +
    '<div class="r"><span>' + esc(notifOn ? t('notifOn') : t('notifEnable')) + (!nativeAlarms && perm === 'denied' ? '<small>' + esc(t('notifBlocked')) + '</small>' : '') + '</span>' + toggle('notif', notifOn, notifDis) + '</div>' +
    '<div class="r"><span>' + esc(t('setSound')) + '</span>' + select('sound', S.sound, [['bundled', t('soundBundled')], ['chime', t('soundChime')], ['file', t('soundFile')], ['off', t('soundOff')]]) + '</div>' +
    (S.sound === 'bundled' ? (function () {
      const opts = [['1', t('soundAdhan1')], ['2', t('soundAdhan2')], ['3', t('soundAdhan3')]];
      return '<div class="r"><span>' + esc(t('setAdhanFajr')) + '</span>' + select('adhanFajr', S.adhanFajr || '2', opts) + '</div>' +
        '<div class="r"><span>' + esc(t('setAdhanDhuhr')) + '</span>' + select('adhanDhuhr', S.adhanDhuhr || '3', opts) + '</div>' +
        '<div class="r"><span>' + esc(t('setAdhanMaghrib')) + '</span>' + select('adhanMaghrib', S.adhanMaghrib || '1', opts) + '</div>' +
        '<p class="note">' + esc(t('soundCredits')) + '</p>';
    })() : '') +
    '<div class="r"><span>' + esc(t('soundFile')) + '</span><span class="btns" style="margin:0"><label class="btn sm" style="cursor:pointer">' + esc(t('soundChoose')) + '<input type="file" accept="audio/*" id="adhanFile" hidden></label><button class="btn sm" data-act="soundTest">' + esc(t('soundTest')) + '</button></span></div></div>' +
    (capPlugin('AsmaAlarms') ? ('<div class="set"><div class="st">' + esc(t('androidAlarms')) + '</div>' +
      '<p class="note">' + esc(t('androidAlarmsHint')) + '</p>' +
      '<p class="note" id="androidAlarmStatus">' + esc(t('androidAlarmsWait')) + '</p>' +
      '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="androidReady">' + esc(t('androidAlarmsAllow')) + '</button></div></div>' +
      '<div class="set"><div class="st">' + esc(t('androidIsland')) + '</div>' +
      '<p class="note">' + esc(t('androidIslandHint')) + '</p>' +
      '<p class="note">' + esc(t('androidWidgetHint')) + '</p>' +
      '<p class="note" id="androidIslandStatus"></p>' +
      '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="islandOn">' + esc(t('androidIslandOn')) + '</button><button class="btn sm" data-act="islandOff">' + esc(t('androidIslandOff')) + '</button><button class="btn sm" data-act="pinWidget">' + esc(t('androidWidgetAdd')) + '</button></div></div>') : '');

  s += '<div class="set"><div class="st">' + esc(t('updTitle')) + '</div>' +
    '<p class="note">' + esc(t('updNow')) + ': ' + esc(APP_NAME) + '</p>' +
    (nativeInstall() ? '<p class="note">' + esc(t('updPhoneHint')) + '</p>' : '') +
    '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="checkUpdate">' + esc(t('updCheck')) + '</button></div></div>';

  s += '<div class="set"><div class="st">' + esc(t('reportBug')) + '</div>' +
    '<p class="note">' + esc(t('reportBugHint')) + '</p>' +
    '<p class="note">' + esc(t('reportContentHint')) + '</p>' +
    '<label class="field"><span>' + esc(t('reportBug')) + '</span><textarea id="bugBody" rows="4" maxlength="2000"></textarea></label>' +
    '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="reportBug">' + esc(t('reportBugGo')) + '</button></div></div>';

  s += '<div class="btns"><button class="btn danger" data-act="resetAll">' + esc(t('reset')) + '</button></div>';
  openSheet(s, prev);
  refreshAndroidStatus();
  const f = $('#adhanFile');
  if (f) f.addEventListener('change', async () => {
    const file = f.files && f.files[0]; if (!file) return;
    try { await idbSet('adhan', file); S.sound = 'file'; save(); adhanUrl = null; toast(t('soundSaved')); renderSettings(); } catch (e) { toast('Could not save the file'); }
  });
}

function capPlugin(name) {
  try {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) return null;
    if (typeof cap.isNativePlatform !== 'function' && !(cap.Plugins && cap.Plugins[name])) return null;
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    if (typeof cap.registerPlugin === 'function') {
      cap.Plugins = cap.Plugins || {};
      cap.Plugins[name] = cap.registerPlugin(name);
      return cap.Plugins[name];
    }
    return null;
  } catch (e) { return null; }
}
function prayerSlotOn(k) {
  const it = S.routine.find(x => x.key === k);
  return !it || it.on !== false;
}
function syncAndroidAlarms() {
  const pl = capPlugin('AsmaAlarms');
  if (!pl) return;
  const now = new Date();
  const today = timesFor(now);
  const tom = timesFor(addDays(now, 1));
  const items = [];
  if (S.sound !== 'off') {
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
      if (!prayerSlotOn(k)) return;
      let at = today[k];
      if (!at || at.getTime() <= now.getTime() + 15000) at = tom[k];
      if (!at) return;
      items.push({ id: k, at: at.getTime(), key: k, title: t('timeFor') + ' ' + t(k), body: fmtHM(at) });
    });
  }
  let mag = today.maghrib, noticeDay = addDays(now, 1);
  if (!mag || mag.getTime() <= now.getTime() + 15000) {
    mag = tom.maghrib;
    noticeDay = addDays(now, 2);
  }
  const msg = mag ? dayNoticeFor(noticeDay, 'eve') : null;
  if (msg && mag) {
    items.push({
      id: 'fast-eve',
      at: mag.getTime() + 120000,
      key: 'notice',
      title: msg.title,
      body: msg.body,
      speak: msg.speak || msg.body,
      share: msg.share || (msg.body + '\n' + SITE_URL),
      lang: S.lang,
      stay: true
    });
  }
  let fajrAt = today.fajr, mornDay = now;
  if (!fajrAt || fajrAt.getTime() <= now.getTime() + 15000) {
    fajrAt = tom.fajr;
    mornDay = addDays(now, 1);
  }
  const morn = fajrAt ? dayNoticeFor(mornDay, 'morn') : null;
  if (morn && fajrAt) {
    items.push({
      id: 'fast-morn',
      at: fajrAt.getTime() + 120000,
      key: 'notice',
      title: morn.title,
      body: morn.body,
      speak: morn.speak || morn.body,
      share: morn.share || (morn.body + '\n' + SITE_URL),
      lang: S.lang,
      stay: true
    });
  }
  if (!items.length) pl.cancelAll().catch(() => {});
  else pl.schedule({ items: items }).catch(() => {});
  postTodayFastNotice();
}
function postTodayFastNotice() {
  const pl = capPlugin('AsmaAlarms');
  if (!pl || typeof pl.showFastNotice !== 'function' || !S.notif) return;
  const now = new Date();
  const tm = timesFor(now);
  if (!tm.fajr || now < tm.fajr) return;
  if (tm.maghrib && now >= tm.maghrib) return;
  const msg = dayNoticeFor(now, 'morn');
  if (!msg) return;
  const k = dkey(now);
  if (S.fastPosted === k) return;
  S.fastPosted = k;
  save();
  pl.showFastNotice({
    title: msg.title,
    body: msg.body,
    speak: msg.speak || msg.body,
    share: msg.share || (msg.body + '\n' + SITE_URL),
    lang: S.lang,
    stay: true
  }).catch(() => {});
}
function refreshAndroidStatus() {
  const el = $('#androidAlarmStatus');
  const pl = capPlugin('AsmaAlarms');
  if (!el || !pl || typeof pl.getStatus !== 'function') return;
  pl.getStatus().then(st => {
    const parts = [];
    parts.push(st.exact ? t('androidExactOk') : t('androidExactNeed'));
    parts.push(st.battery ? t('androidBatteryOk') : t('androidBatteryNeed'));
    parts.push(st.notif ? t('androidNotifOk') : t('androidNotifNeed'));
    el.textContent = parts.join(' ');
    const isl = $('#androidIslandStatus');
    if (isl) {
      const bits = [];
      bits.push(st.overlay ? t('androidOverlayOk') : t('androidOverlayNeed'));
      bits.push(st.island ? t('androidIslandOn') : t('androidIslandOff'));
      isl.textContent = bits.join(' ');
    }
  }).catch(() => {});
}

function setPath(path, val) {
  const p = path.split('.'); let o = S;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  o[p[p.length - 1]] = val;
}
function getPath(path) { return path.split('.').reduce((o, k) => o[k], S); }
function afterSetting(path) {
  save();
  if (/^(method|asr|imsakMin|adj\.|hijriAdj|hijriMaghrib|loc)/.test(path)) invalidate();
  if (path === 'lang') { S.arAll = S.lang === 'ar' ? true : S.arAll; applyLang(); }
  renderAll(true);
  if (!$('#sheet').hidden && !$('#rtForm')) renderSettings();
  if (/^(method|asr|imsakMin|adj\.|loc|sound|lang|notif)/.test(path)) syncAndroidAlarms();
}

/* ---------- sheet and toast ---------- */
function openSheet(html, scroll) {
  const sh = $('#sheet');
  $('#sheetIn').innerHTML = html;
  sh.hidden = false;
  sh.scrollTop = scroll || 0;
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('#sheet').hidden = true; document.body.style.overflow = ''; }
function toast(msg, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'toast' + (opts.big ? ' big' : '');
  el.innerHTML = '<span>' + esc(msg) + '</span>';
  if (opts.action) { const b = document.createElement('button'); b.textContent = opts.action; b.addEventListener('click', () => { opts.onAction && opts.onAction(); el.remove(); }); el.appendChild(b); }
  $('#toast').appendChild(el);
  const ms = opts.ms == null ? 3800 : opts.ms;
  if (ms > 0) setTimeout(() => { if (el.parentNode) el.remove(); }, ms);
  return el;
}

/* ---------- language ---------- */
function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('appName');
}
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
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const st = t0 + i * 0.45;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.22, st + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, st + 1.3);
    o.connect(g); g.connect(c.destination); o.start(st); o.stop(st + 1.4);
  });
}
function bundledPick(it) {
  const k = it && it.key;
  if (k === 'fajr') return S.adhanFajr || '2';
  if (k === 'dhuhr' || k === 'asr') return S.adhanDhuhr || '3';
  if (k === 'maghrib' || k === 'isha') return S.adhanMaghrib || '1';
  return S.adhanFajr || '2';
}
function bundledSrc(it) {
  const n = bundledPick(it);
  return 'audio/adhan-' + (n === '2' || n === '3' ? n : '1') + '.m4a';
}
let wantPlay = false, keepT = 0;
function armKeep() {
  clearInterval(keepT);
  keepT = setInterval(() => {
    if (!wantPlay || !aud) { clearInterval(keepT); keepT = 0; return; }
    if (aud.ended) { wantPlay = false; clearInterval(keepT); keepT = 0; return; }
    if (aud.paused) aud.play().catch(() => {});
  }, 1500);
}
async function playUrl(src) {
  if (!aud) aud = new Audio();
  try { aud.pause(); } catch (e) { /* ignore */ }
  aud.preload = 'auto';
  aud.src = src;
  try { aud.currentTime = 0; } catch (e) { /* ignore */ }
  aud.onpause = () => { if (wantPlay && !aud.ended) aud.play().catch(() => {}); };
  await aud.play();
  armKeep();
  return aud;
}
async function playSound(kind, it) {
  stopSound();
  if (!aud) aud = new Audio();
  if (S.sound === 'off') return;
  if (kind !== 'adhan' || S.sound === 'chime') { chime(); return; }
  wantPlay = true;
  if (S.sound === 'file') {
    try {
      if (!adhanUrl) { const b = await idbGet('adhan'); if (b) adhanUrl = URL.createObjectURL(b); }
      if (adhanUrl) { await playUrl(adhanUrl); return; }
    } catch (e) { /* fall back */ }
    wantPlay = false; chime();
    return;
  }
  try { await playUrl(bundledSrc(it)); } catch (e) { wantPlay = false; chime(); }
}
function stopSound() {
  wantPlay = false; clearInterval(keepT); keepT = 0;
  if (aud) { aud.onpause = null; aud.pause(); aud.currentTime = 0; }
}
function unlockAudio() {
  audioCtx();
  if (S.sound === 'file') {
    idbGet('adhan').then(b => {
      if (!b) return;
      adhanUrl = URL.createObjectURL(b); aud = new Audio(adhanUrl); aud.muted = true;
      aud.play().then(() => { aud.pause(); aud.muted = false; aud.currentTime = 0; }).catch(() => { aud.muted = false; });
    }).catch(() => {});
  } else if (S.sound === 'bundled' || !S.sound) {
    try {
      aud = new Audio(bundledSrc({ key: 'dhuhr' }));
      aud.muted = true;
      aud.play().then(() => { aud.pause(); aud.muted = false; aud.currentTime = 0; }).catch(() => { aud.muted = false; });
    } catch (e) { /* ignore */ }
  }
}
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('asma', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function idbSet(k, v) { return idb().then(db => new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); })); }
function idbGet(k) { return idb().then(db => new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }

/* ---------- alerts ---------- */
const firedKeys = new Set();
let lastAlertCheck = Date.now();
function checkAlerts(now) {
  if (window.asmaDesktop) return; /* the island handles alerts in the desktop app */
  const from = Math.max(lastAlertCheck, now.getTime() - 90000), to = now.getTime();
  lastAlertCheck = to;
  const isFast = isFasting(now);
  S.routine.forEach(it => {
    if (!it.on) return;
    if (it.fast && !isFast) return;
    const at = itemTime(it, now); if (!at) return;
    const ms = at.getTime();
    if (ms > from && ms <= to) {
      const k = dkey(now) + '|' + it.id;
      if (firedKeys.has(k)) return;
      firedKeys.add(k);
      fireAlert(it, at);
    }
  });
  checkDayNotices(now);
}
function pickQuote(kinds, day) {
  const all = D.FAST_QUOTES || [];
  let list = all.filter(q => (q.for || []).some(k => kinds.indexOf(k) >= 0));
  if (!list.length) list = all.filter(q => (q.for || []).indexOf('general') >= 0);
  if (!list.length) return null;
  const n = day.getFullYear() * 400 + day.getMonth() * 40 + day.getDate();
  return list[Math.abs(n) % list.length];
}
function quoteLine(q) {
  if (!q) return '';
  const text = S.lang === 'ar' ? q.ar : (S.lang === 'fr' ? q.fr : q.en);
  return t('quoteLbl') + ': ' + text + ' (' + q.src + ')';
}
function emitNotice(title, body, tag) {
  toast(title + (body ? '. ' + body.split('\n')[0] : ''), { big: true, ms: 12000 });
  if (S.notif && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: body || title, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: tag || 'asma-day', renotify: true, lang: S.lang, dir: S.lang === 'ar' ? 'rtl' : 'ltr' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { /* ignore */ } });
    else try { new Notification(title, opts); } catch (e) { /* ignore */ }
  }
}
function whiteDaysList(day, h) {
  const start = addDays(day, 13 - h.d);
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const d = addDays(start, i);
    const hh = hijriOf(d);
    parts.push(nA(hh.d) + ' ' + D.MONTHS_H[S.lang][hh.m - 1] + ' (' + fmtGreg(d, true) + ')');
  }
  return parts.join(S.lang === 'ar' ? '، ' : '; ');
}
function dayNoticeFor(day, when) {
  const fi = fastInfo(day), h = hijriOf(day);
  const shareLine = t('fastShareLine').replace('%url', SITE_URL);
  if (fi.forbidden) {
    const eid = (h.m === 10 && h.d === 1) ? D.EVENTS.find(e => e[0] === 10 && e[1] === 1) : D.EVENTS.find(e => e[0] === 12 && e[1] === 10);
    const q = pickQuote(['eid'], day);
    const body = t('eidNoticeBody') + '\n' + quoteLine(q);
    return { title: t('eidNoticeTitle') + (eid ? ': ' + L(eid[2]) : ''), body: body, speak: body, share: body + '\n' + shareLine };
  }
  const kinds = [];
  if (fi.ramadan) kinds.push('ramadan');
  if (fi.tags.indexOf('fastMon') >= 0 || fi.tags.indexOf('fastThu') >= 0) kinds.push('mon');
  if (fi.tags.indexOf('fastWhite') >= 0) kinds.push('white');
  if (fi.tags.indexOf('fastArafah') >= 0) kinds.push('arafah');
  if (fi.tags.indexOf('fastAshura') >= 0) kinds.push('ashura');
  if (fi.tags.indexOf('fastShawwal') >= 0) kinds.push('shawwal');
  if (!fi.ramadan && !fi.tags.length) return null;
  const q = pickQuote(kinds.length ? kinds : ['general'], day);
  const bits = [];
  let speak = '';
  if (fi.ramadan) bits.push(h.d === 1 ? t('ramadanCome') : t('ramadanDay'));
  else {
    bits.push(when === 'eve' ? t('fastEveSunnah') : t('fastMornSunnah'));
    const names = [];
    if (fi.tags.indexOf('fastMon') >= 0) names.push(t('fastMon'));
    if (fi.tags.indexOf('fastThu') >= 0) names.push(t('fastThu'));
    if (fi.tags.indexOf('fastArafah') >= 0) names.push(t('fastArafah'));
    if (fi.tags.indexOf('fastAshura') >= 0) names.push(t('fastAshura'));
    if (fi.tags.indexOf('fastShawwal') >= 0) names.push(t('fastShawwal'));
    if (names.length) bits.push(names.join(' · '));
    if (fi.tags.indexOf('fastWhite') >= 0) {
      const end = nA(15) + ' ' + D.MONTHS_H[S.lang][h.m - 1] + ' ' + nA(h.y);
      const days = whiteDaysList(day, h);
      const left = h.d === 13 ? 3 : (h.d === 14 ? 2 : 1);
      const wk = (when === 'eve' ? 'whiteEve' : 'white') + left;
      bits.push(t(wk).replace('%end', end).replace('%days', days));
      bits.push(t('whiteDaysList').replace('%days', days));
      if (when === 'eve') speak = t('fastSpeakWhite').replace('%end', end).replace('%days', days);
    } else if (when === 'eve' && fi.tags.indexOf('fastMon') >= 0) speak = t('fastSpeakMon');
    else if (when === 'eve' && fi.tags.indexOf('fastThu') >= 0) speak = t('fastSpeakThu');
    bits.push(t('fastEncourage'));
  }
  bits.push(t('fastAccept'));
  bits.push(quoteLine(q));
  bits.push(shareLine);
  if (when === 'morn' && !speak) speak = t('fastSpeakToday');
  const title = fi.ramadan ? t('ramadan') : (when === 'eve' ? t('fastEveTitle') : t('fastMornTitle'));
  const body = bits.filter(Boolean).join('\n');
  return { title: title, body: body, speak: speak || body, share: body };
}
function checkDayNotices(now) {
  const tm = timesFor(now);
  if (tm.fajr && now >= tm.fajr && (!tm.maghrib || now < tm.maghrib)) {
    const k = dkey(now) + '|dayMorn';
    if (!firedKeys.has(k)) {
      const msg = dayNoticeFor(now, 'morn');
      if (msg) { firedKeys.add(k); if (!capPlugin('AsmaAlarms')) emitNotice(msg.title, msg.body, 'asma-day-morn'); else postTodayFastNotice(); }
      else firedKeys.add(k);
    }
  }
  if (tm.maghrib && now >= tm.maghrib) {
    const k = dkey(now) + '|dayEve';
    if (!firedKeys.has(k)) {
      const msg = dayNoticeFor(addDays(now, 1), 'eve');
      if (msg) {
        firedKeys.add(k);
        if (!capPlugin('AsmaAlarms')) emitNotice(msg.title, msg.body, 'asma-day-eve');
      } else firedKeys.add(k);
    }
  }
}
function fireAlert(it, at) {
  const label = itemLabel(it);
  const title = t('timeFor') + ' ' + label;
  const dua = it.dua ? D.DUAS.find(d => d.id === it.dua) : null;
  const body = dua ? dua.ar : (it.fast ? t('fastAlertBody') : fmtHM(at));
  const useAdhan = it.adhan || !it.key;
  playSound(useAdhan ? 'adhan' : 'chime', it);
  const hold = 12 * 60 * 1000;
  const bar = toast(title, { big: true, ms: hold, action: t('stop'), onAction: stopSound });
  if (aud) {
    aud.onended = () => { if (bar && bar.parentNode) bar.remove(); };
  }
  if (S.notif && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'asma-' + it.id, renotify: true, lang: S.lang, dir: S.lang === 'ar' ? 'rtl' : 'ltr', silent: true };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { /* ignore */ } });
    else try { new Notification(title, opts); } catch (e) { /* ignore */ }
  }
}
async function enableNotif() {
  const pl = capPlugin('AsmaAlarms');
  if (pl && typeof pl.requestNotifications === 'function') {
    try {
      const r = await pl.requestNotifications();
      S.notif = !!(r && r.granted);
      save();
      if (S.notif) { toast(t('notifOn')); audioCtx(); syncAndroidAlarms(); }
      else toast(t('androidNotifNeed'));
    } catch (e) { toast(t('androidNotifNeed')); }
    renderSettings();
    return;
  }
  if (!('Notification' in window)) return;
  try {
    const p = await Notification.requestPermission();
    S.notif = p === 'granted'; save();
    if (S.notif) { toast(t('notifOn')); audioCtx(); syncAndroidAlarms(); }
  } catch (e) { /* ignore */ }
  renderSettings();
}

/* ---------- location and daily check ---------- */
function applyCustomLocation() {
  const lat = parseFloat($('#locLat') && $('#locLat').value);
  const lng = parseFloat($('#locLng') && $('#locLng').value);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    toast(t('locBad'));
    return;
  }
  const typed = ($('#locName') && $('#locName').value.trim()) || '';
  S.loc = { auto: false, lat, lng, name: typed || nearestCity(lat, lng) };
  S.fresh = false;
  invalidate(); save(); renderAll(true);
  syncAndroidAlarms();
  toast(t('locOk') + ': ' + S.loc.name);
  if (!$('#sheet').hidden) renderSettings();
}
function nearestCity(lat, lng) {
  let best = null, bd = 1e9;
  D.CITIES.forEach(c => { const d = C.distKm(lat, lng, c[1], c[2]); if (d < bd) { bd = d; best = c; } });
  return best && bd < 60 ? best[0] : lat.toFixed(2) + ', ' + lng.toFixed(2);
}
function refreshLocation(manual) {
  return new Promise(resolve => {
    const done = (lat, lng) => {
      const moved = C.distKm(lat, lng, S.loc.lat, S.loc.lng);
      if (manual || moved > 25 || S.fresh) {
        S.loc = { auto: true, lat, lng, name: nearestCity(lat, lng) }; S.fresh = false;
        invalidate(); save(); renderAll(true);
        if (manual) toast(t('locOk') + ': ' + S.loc.name);
      }
      resolve(true);
    };
    const fail = (kind) => {
      const dk = window.asmaDesktop;
      if (dk && dk.ipLocation) {
        dk.ipLocation().then(p => {
          if (p && isFinite(p.lat) && isFinite(p.lng)) done(p.lat, p.lng);
          else { if (manual) toast(t('locFail')); resolve(false); }
        }).catch(() => { if (manual) toast(t('locFail')); resolve(false); });
      } else {
        if (manual) toast(kind === 'off' ? t('locGpsOff') : (kind === 'denied' ? t('locNeed') : t('locFail')));
        resolve(false);
      }
    };
    const tryNative = () => {
      const pl = capPlugin('AsmaAlarms');
      if (pl && typeof pl.getLocation === 'function') {
        pl.getLocation().then(p => {
          if (p && isFinite(p.lat) && isFinite(p.lng)) done(p.lat, p.lng);
          else fail('fail');
        }).catch(err => {
          const msg = String((err && (err.message || err.errorMessage || err)) || '');
          if (/off/i.test(msg)) fail('off');
          else if (/denied/i.test(msg)) fail('denied');
          else fail('fail');
        });
        return;
      }
      fail('fail');
    };
    /* the desktop app has no OS location service, so it uses the network location instead */
    if (window.asmaDesktop) return fail('fail');
    if (capPlugin('AsmaAlarms')) return tryNative();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => done(pos.coords.latitude, pos.coords.longitude),
        () => tryNative(),
        { timeout: 8000, maximumAge: 6 * 3600 * 1000, enableHighAccuracy: false }
      );
    } else tryNative();
  });
}
let updKind = '', updUrl = '', updCode = 0;
function nativeInstall() {
  return !!(capPlugin('AsmaAlarms') || window.asmaDesktop);
}
function hideUpd() {
  const el = $('#upd');
  if (el) el.hidden = true;
}
function showUpd(kind, url, code, body) {
  const el = $('#upd');
  if (!el) return;
  updKind = kind;
  updUrl = url || '';
  updCode = code || 0;
  const go = kind === 'web' ? t('updReload') : t('updGet');
  el.innerHTML = '<p>' + esc(t('updTitle') + '. ' + body) + '</p><div class="btns"><button class="btn sm" data-act="updGo">' + esc(go) + '</button><button class="btn sm" data-act="updLater">' + esc(t('updLater')) + '</button></div>';
  el.hidden = false;
  if (S.notif && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: body, tag: 'asma-update', renotify: true, icon: 'icons/icon-192.png' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(t('updTitle'), opts)).catch(() => { try { new Notification(t('updTitle'), opts); } catch (e) { /* ignore */ } });
    else try { new Notification(t('updTitle'), opts); } catch (e) { /* ignore */ }
  }
}
function fetchRemoteVersion() {
  return fetch(UPDATE_URLS[0], { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).catch(() =>
    fetch(UPDATE_URLS[1], { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
  );
}
function checkAppUpdate(force) {
  if (nativeInstall()) {
    if (!force && S.updateChecked && Date.now() - S.updateChecked < 5 * 60 * 1000) return;
    fetchRemoteVersion().then(j => {
      S.updateChecked = Date.now();
      save();
      if (!j) {
        if (force) toast(t('updFail'));
        return;
      }
      const code = parseInt(j.apkCode, 10) || 0;
      if (code <= APP_BUILD) {
        if (force) toast(t('updNone'));
        return;
      }
      if (!force && S.updateDismissed === code) return;
      showUpd('apk', j.apkUrl || UPDATE_URLS[0], code, t('updApkBody') + (j.apkName ? ' (' + j.apkName + ')' : ''));
    }).catch(() => { if (force) toast(t('updFail')); });
    return;
  }
  if (force) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) showUpd('web', '', 0, t('updWebBody'));
        else toast(t('updNone'));
      }).catch(() => toast(t('updNone')));
    } else toast(t('updNone'));
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
    navigator.serviceWorker.getRegistration().then(reg => { if (reg && reg.update) reg.update(); }).catch(() => {});
  }
}
function bindServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const had = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (!had) return;
      if (reg.waiting) showUpd('web', '', 0, t('updWebBody'));
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) showUpd('web', '', 0, t('updWebBody'));
        });
      });
    }).catch(() => {});
  });
}

function dailyCheck(force) {
  const now = new Date(), k = dkey(now);
  if (!force && S.lastCheck === k) return;
  S.lastCheck = k; S.checkedAt = now.getTime();
  /* prune old fasting marks */
  Object.keys(S.fasting).forEach(d => { if (d < dkey(addDays(now, -2))) delete S.fasting[d]; });
  invalidate(); save();
  if (S.loc.auto) refreshLocation(false);
  syncAndroidAlarms();
}

/* ---------- routing ---------- */
function renderTab(tab) {
  if (tab === 'clock') renderClockView();
  else if (tab === 'prayer') renderPrayer();
  else if (tab === 'calendar') renderCalendar();
  else if (tab === 'routine') renderRoutine();
  else if (tab === 'duas') renderDuas();
  else if (tab === 'learn') renderLearn();
}
function showTab(tab) {
  if (S.tab === 'duas') duaY[duaCat] = window.scrollY;
  setDuaSide(false);
  S.tab = tab; save();
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
  renderNavLabels();
  renderTab(tab);
  if (tab === 'duas' && duaTab === 'duas') window.scrollTo(0, duaY[duaCat] || 0);
  else window.scrollTo(0, 0);
}
function renderAll() {
  renderNavLabels();
  renderTab(S.tab);
}

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act],[data-step]');
  if (!b) return;
  if (b.dataset.step) {
    const path = b.dataset.step, v = Math.max(+b.dataset.min, Math.min(+b.dataset.max, (+getPath(path) || 0) + (+b.dataset.d)));
    setPath(path, v); afterSetting(path); return;
  }
  const a = b.dataset.act;
  switch (a) {
    case 'tab': showTab(b.dataset.tab); break;
    case 'settings': renderSettings(); break;
    case 'closeSheet': closeSheet(); break;
    case 'toggleFast': { const k = dkey(new Date()); if (S.fasting[k]) delete S.fasting[k]; else S.fasting[k] = true; save(); tick(true); renderWeek(); break; }
    case 'gotoDay': { ensureCal(); const p = b.dataset.date.split('-'); cal.sel = new Date(+p[0], +p[1] - 1, +p[2], 12); const h = hijriOf(cal.sel); cal.hy = h.y; cal.hm = h.m; cal.gy = cal.sel.getFullYear(); cal.gm = cal.sel.getMonth(); showTab('calendar'); break; }
    case 'calMode': S.calMode = b.dataset.mode; ensureCal(); { const h = hijriOf(cal.sel); cal.hy = h.y; cal.hm = h.m; cal.gy = cal.sel.getFullYear(); cal.gm = cal.sel.getMonth(); } save(); renderCalendar(); break;
    case 'calPrev': calShift(-1); renderCalendar(); break;
    case 'calNext': calShift(1); renderCalendar(); break;
    case 'calSel': { const p = b.dataset.date.split('-'); cal.sel = new Date(+p[0], +p[1] - 1, +p[2], 12); renderCalendar(); break; }
    case 'rtEdit': openRoutineEditor(b.dataset.id); break;
    case 'rtAdd': openRoutineEditor(null); break;
    case 'rtDel': S.routine = S.routine.filter(x => x.id !== b.dataset.id); save(); closeSheet(); renderRoutine(); break;
    case 'rtReset': S.routine = clone(D.ROUTINE); save(); firedKeys.clear(); renderRoutine(); syncAndroidAlarms(); break;
    case 'duaTab': duaY[duaCat] = window.scrollY; duaTab = b.dataset.v; renderDuas(); break;
    case 'duaCat': duaY[duaCat] = window.scrollY; duaCat = b.dataset.c; renderDuas(); break;
    case 'duaSide': setDuaSide(true); break;
    case 'duaSideClose': setDuaSide(false); break;
    case 'learnTab': learnTab = b.dataset.v; renderLearn(); window.scrollTo(0, 0); break;
    case 'dictLetter': dictLetter = b.dataset.l || ''; renderLearn(); break;
    case 'reportDict': {
      window.open(issueUrl('Dictionary report', 'Word: ' + (b.dataset.ar || '') + '\n(describe the error in the meaning or the source)'), '_blank');
      break;
    }
    case 'accToggle': {
      accOpen[b.dataset.id] = !accOpen[b.dataset.id];
      const y = window.scrollY;
      renderLearn();
      window.scrollTo(0, y);
      break;
    }
    case 'accGo': accGo(b.dataset.id, +b.dataset.d); break;
    case 'checkUpdate': checkAppUpdate(true); break;
    case 'updLater':
      if (updKind === 'apk' && updCode) { S.updateDismissed = updCode; save(); }
      hideUpd();
      break;
    case 'updGo':
      if (updKind === 'web') { hideUpd(); location.reload(); break; }
      if (updUrl) window.open(updUrl, '_blank');
      break;
    case 'reportBug': {
      const body = ($('#bugBody') && $('#bugBody').value.trim()) || '';
      window.open(issueUrl('Bug or content report', body || '(describe the problem or the dua that needs a correction)'), '_blank');
      break;
    }
    case 'locUpdate': refreshLocation(true).then(() => { if (!$('#sheet').hidden) renderSettings(); }); break;
    case 'locApply': applyCustomLocation(); break;
    case 'soundTest': {
      unlockAudio();
      if (S.sound === 'off') { toast(t('soundOff')); break; }
      const np = nextPrayer(new Date());
      playSound('adhan', { key: np.key, adhan: true });
      const bar = toast(t('soundTest'), { action: t('stop'), onAction: stopSound, ms: 12 * 60 * 1000 });
      if (aud) aud.onended = () => { if (bar && bar.parentNode) bar.remove(); };
      break;
    }
    case 'androidReady': {
      const pl = capPlugin('AsmaAlarms');
      if (pl && typeof pl.requestReady === 'function') {
        pl.requestReady().then(() => { refreshAndroidStatus(); syncAndroidAlarms(); }).catch(() => {});
      }
      break;
    }
    case 'islandOn': {
      const pl = capPlugin('AsmaAlarms');
      if (!pl) break;
      const go = () => pl.startIsland().then(() => refreshAndroidStatus()).catch(() => toast(t('androidOverlayNeed')));
      if (typeof pl.requestOverlay === 'function') {
        pl.requestOverlay().then(r => { if (r && r.granted) go(); else toast(t('androidOverlayNeed')); }).catch(() => toast(t('androidOverlayNeed')));
      } else go();
      break;
    }
    case 'islandOff': {
      const pl = capPlugin('AsmaAlarms');
      if (pl && typeof pl.stopIsland === 'function') pl.stopIsland().then(() => refreshAndroidStatus()).catch(() => {});
      break;
    }
    case 'pinWidget': {
      const pl = capPlugin('AsmaAlarms');
      if (pl && typeof pl.pinWidget === 'function') {
        pl.pinWidget().then(r => { if (!r || !r.ok) toast(t('androidPinNeed')); }).catch(() => toast(t('androidPinNeed')));
      } else toast(t('androidPinNeed'));
      break;
    }
    case 'resetAll': try { localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } S = load(); invalidate(); applyLang(); closeSheet(); showTab('clock'); syncAndroidAlarms(); break;
    default: break;
  }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.rton) {
    const it = S.routine.find(x => x.id === el.dataset.rton); if (it) { it.on = el.checked; save(); if (el.checked) { audioCtx(); } syncAndroidAlarms(); } return;
  }
  const path = el.dataset && el.dataset.set; if (!path) return;
  if (path === 'city') {
    if (el.value === '__custom') return;
    if (el.value === '__auto') { S.loc.auto = true; refreshLocation(true); }
    else { const c = D.CITIES.find(x => x[0] === el.value); if (c) { S.loc = { auto: false, lat: c[1], lng: c[2], name: c[0] }; S.fresh = false; } }
    invalidate(); afterSetting('loc'); return;
  }
  if (path === 'notif') {
    if (el.checked) enableNotif();
    else { S.notif = false; save(); renderSettings(); }
    return;
  }
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (['asr', 'weekStart'].includes(path)) v = parseInt(v, 10);
  setPath(path, v); afterSetting(path);
});

document.addEventListener('pointerdown', function once() { unlockAudio(); document.removeEventListener('pointerdown', once); }, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    startLoops();
    dailyCheck(false); checkAppUpdate(false); lastSec = -1; tick(true); syncAndroidAlarms();
    refreshAndroidStatus();
  } else {
    stopLoops();
  }
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if ($('#duaSide') && $('#duaSide').classList.contains('on')) { setDuaSide(false); return; }
  if (!$('#sheet').hidden) closeSheet();
});

const TABS = ['clock', 'prayer', 'calendar', 'routine', 'duas', 'learn'];
let swipeX = 0, swipeY = 0, swipeOn = false;
function swipeBlocked(el) {
  if (!$('#sheet').hidden) return true;
  if ($('#duaSide') && $('#duaSide').classList.contains('on')) return true;
  return !!(el && el.closest && el.closest('input, textarea, select, .nav, .sheet, .dua-side, .dua-mask, .acc-track, .acc-head, .acc-nav, .dict-letters'));
}
document.addEventListener('touchstart', ev => {
  if (ev.touches.length !== 1) { swipeOn = false; return; }
  if (swipeBlocked(ev.target)) { swipeOn = false; return; }
  swipeOn = true;
  swipeX = ev.touches[0].clientX;
  swipeY = ev.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchcancel', () => { swipeOn = false; });
document.addEventListener('touchend', ev => {
  if (!swipeOn) return;
  swipeOn = false;
  const t = ev.changedTouches && ev.changedTouches[0];
  if (!t) return;
  const dx = t.clientX - swipeX, dy = t.clientY - swipeY;
  if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
  const i = TABS.indexOf(S.tab);
  if (i < 0) return;
  if (dx < 0 && i < TABS.length - 1) showTab(TABS[i + 1]);
  else if (dx > 0 && i > 0) showTab(TABS[i - 1]);
}, { passive: true });

/* ---------- start ---------- */
applyLang();
showTab(S.tab || 'clock');
dailyCheck(false);
checkAppUpdate(false);
syncAndroidAlarms();
if (S.fresh && S.loc.auto) { refreshLocation(false); }
startLoops();
(function bootNative() {
  const pl = capPlugin('AsmaAlarms');
  if (!pl) return;
  if (typeof pl.pushStore === 'function') pl.pushStore({ json: JSON.stringify(S) }).catch(() => {});
  if (typeof pl.getStatus === 'function') pl.getStatus().then(() => {}).catch(() => {});
})();

bindServiceWorker();
window.__asma = { S: () => S, tick: () => tick(true), fire: id => { const it = S.routine.find(x => x.id === id); if (it) fireAlert(it, new Date()); } };
})();
