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
const DEF = {
  lang: 'en', arClock: true, arAll: false, h24: false, method: 'MWL', asr: 1,
  adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  imsakMin: 10, hijriAdj: 0, hijriMaghrib: true, weekStart: 1,
  loc: { auto: true, lat: 5.36, lng: -4.0083, name: 'Abidjan' },
  notif: false, sound: 'chime', wake: false, panel: 'minute',
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
  if (!s.lang) { const nl = (navigator.language || 'en').slice(0, 2); if (nl === 'fr' || nl === 'ar') o.lang = nl; }
  return o;
}
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }, 150); }

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
  if (!forbidden && !ramadan) {
    if (dow === 1) tags.push('fastMon');
    if (dow === 4) tags.push('fastThu');
    if (h.d >= 13 && h.d <= 15) tags.push('fastWhite');
    if (h.m === 12 && h.d === 9) tags.push('fastArafah');
    if (h.m === 1 && (h.d === 9 || h.d === 10)) tags.push('fastAshura');
  }
  return { forbidden, ramadan, tags };
}
function isFasting(d) {
  const fi = fastInfo(d);
  if (fi.forbidden) return false;
  return fi.ramadan || S.fasting[dkey(d)] === true;
}

/* ---------- SVG dial ---------- */
const NS = 'http://www.w3.org/2000/svg';
const GEO = NAMES.map((n, i) => {
  const a = (i + 0.5) * 360 / 99, flip = a > 180;
  return { tf: 'rotate(' + (flip ? a + 90 : a - 90).toFixed(3) + ')', x: flip ? -224 : 224, an: flip ? 'start' : 'end' };
});
function buildDial() {
  let s = '<svg viewBox="-250 -250 500 500" role="img" aria-label="99 Names of Allah clock">';
  s += '<circle r="249" fill="#101010"/><circle r="243" fill="#f4f4f1"/><circle r="231" fill="none" stroke="#e1e1dc" stroke-width=".6"/>';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0, a = i * 6;
    s += '<line x1="0" y1="-' + (big ? 232 : 236) + '" x2="0" y2="-241" stroke="' + (big ? '#222' : '#9a9a96') + '" stroke-width="' + (big ? 1.4 : .7) + '" transform="rotate(' + a + ')"/>';
  }
  s += '<g id="names">';
  NAMES.forEach((n, i) => {
    const g = GEO[i];
    s += '<text class="nm" id="n' + i + '" transform="' + g.tf + '" x="' + g.x + '" y="0" dy=".35em" text-anchor="' + g.an + '">' + esc(n[0]) + '</text>';
  });
  s += '</g><g id="hl"><text class="nm cur" id="hlT" dy=".35em"></text></g>';
  s += '<circle r="66" fill="#e8e8e4"/><circle r="66" fill="none" stroke="#d4d4cf" stroke-width="1"/>';
  s += '<text y="4" dy=".35em" text-anchor="middle" font-family="Amiri,serif" font-size="46" fill="#d3d3cd">الله</text>';
  s += '<g id="hHand"><line y1="8" y2="-34" stroke="#141414" stroke-width="4" stroke-linecap="round"/></g>';
  s += '<g id="mHand"><line y1="10" y2="-54" stroke="#141414" stroke-width="2.8" stroke-linecap="round"/></g>';
  s += '<circle r="4" fill="#141414"/>';
  s += '<g id="sHand"><circle cx="0" cy="-74" r="3.6" fill="#fff" stroke="#141414" stroke-width="1.2"/><line y1="-77.6" y2="-186" stroke="#141414" stroke-width="1.3"/><polygon points="0,-196 -3.4,-184 3.4,-184" fill="#141414"/></g>';
  s += '</svg>';
  return s;
}

/* ---------- views ---------- */
const views = {};
let lastIdx = -1, lastSec = -1, lastMinKey = '', lastDay = dkey(new Date());
let cal = null;

function renderNavLabels() {
  const keys = ['tabClock', 'tabPrayer', 'tabCalendar', 'tabRoutine', 'tabDuas'];
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

function updateNames(idx) {
  $$('#names .nm').forEach((n, i) => { n.setAttribute('class', i < idx ? 'nm done' : 'nm'); });
  const hl = $('#hlT'), g = GEO[idx];
  hl.textContent = NAMES[idx][0];
  hl.setAttribute('transform', g.tf); hl.setAttribute('x', g.x); hl.setAttribute('y', 0); hl.setAttribute('text-anchor', g.an);
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

function frame() {
  const dial = $('#dial');
  if (dial && S.tab === 'clock') {
    const now = new Date();
    const sf = now.getSeconds() + now.getMilliseconds() / 1000;
    $('#sHand').setAttribute('transform', 'rotate(' + (sf * 6).toFixed(2) + ')');
    $('#mHand').setAttribute('transform', 'rotate(' + ((now.getMinutes() + sf / 60) * 6).toFixed(2) + ')');
    $('#hHand').setAttribute('transform', 'rotate(' + (((now.getHours() % 12) + now.getMinutes() / 60) * 30).toFixed(2) + ')');
    const idx = Math.min(98, Math.floor(sf / 60 * 99));
    if (idx !== lastIdx) {
      lastIdx = idx; updateNames(idx);
      if (S.panel === 'hand') setPanel(idx, true);
    }
  }
  requestAnimationFrame(frame);
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
    const ev = eventsOn(d).length;
    s += '<button class="cell' + (sameDay(d, now) ? ' today' : '') + (sameDay(d, cal.sel) ? ' sel' : '') + (d.getDay() === 5 ? ' fri' : '') + '" data-act="calSel" data-date="' + dkey(d) + '">' +
      (ev ? '<span class="dot"></span>' : '') + '<b>' + nA(main) + '</b><em>' + nA(small) + '</em></button>';
  }
  s += '</div>';

  /* selected day */
  const sd = cal.sel, sh = hijriOf(sd), st = timesFor(sd), fi = fastInfo(sd);
  s += '<div class="card"><h3>' + esc(t('dayDetails')) + '</h3><div class="dayhd"><b>' + esc(fmtGreg(sd, true)) + '</b><span>' + esc(fmtHijri(sh)) + '</span></div>';
  const evs = eventsOn(sd);
  evs.forEach(e => { s += '<div class="note" style="color:var(--acc)">' + esc(e) + '</div>'; });
  const tg = []; if (fi.ramadan) tg.push(t('ramadan')); fi.tags.forEach(k => tg.push(t(k)));
  if (fi.forbidden) s += '<div class="note">' + esc(t('fastNo')) + '</div>';
  else if (tg.length) s += '<div class="note">' + esc(t('sunnahFast')) + ': ' + esc(tg.join(' · ')) + '</div>';
  s += '<div class="ptg">';
  ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => { s += '<div><span>' + esc(t(k)) + '</span><b>' + fmtHM(st[k]) + '</b></div>'; });
  s += '</div></div>';

  /* month events */
  const list = [];
  for (let i = 0; i < len; i++) { const d = addDays(first, i); eventsOn(d).forEach(e => list.push([d, e])); }
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
  let s = '<div class="pagehead"><h2>' + esc(t('routineTitle')) + '</h2><p>' + esc(t('routineSub')) + '</p></div>';
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
  const it = isNew ? { id: 'c' + Date.now(), name: '', fixed: '06:00', on: true } : S.routine.find(x => x.id === id);
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
    if (isNew) S.routine.push(target);
    save(); firedKeys.clear(); closeSheet(); renderRoutine();
  });
}

/* ---------- duas and names ---------- */
let duaTab = 'duas', nameQ = '';
function renderDuas() {
  let s = '<div class="chead" style="margin-top:14px"><div class="pagehead" style="margin:0"><h2>' + esc(t('duasTab')) + '</h2></div><div class="seg"><button data-act="duaTab" data-v="duas" class="' + (duaTab === 'duas' ? 'on' : '') + '">' + esc(t('duasTab')) + '</button><button data-act="duaTab" data-v="names" class="' + (duaTab === 'names' ? 'on' : '') + '">' + esc(t('namesTab')) + '</button></div></div>';
  if (duaTab === 'duas') {
    D.CATS.forEach(c => {
      const list = D.DUAS.filter(d => d.cat === c);
      if (!list.length) return;
      s += '<div class="sub">' + esc(t(D.CAT_KEY[c])) + '</div>';
      list.forEach(d => {
        s += '<div class="card dua"><div class="tt">' + esc(L(d.title)) + '</div><div class="a">' + esc(d.ar) + '</div><div class="tx">' + esc(S.lang === 'fr' ? d.fr : d.en) + '</div>' +
          (S.lang !== 'en' && S.lang !== 'fr' ? '<div class="tx f">' + esc(d.en) + '</div>' : '') +
          (d.note ? '<div class="nt">' + esc(L(d.note)) + '</div>' : '') + '<div class="sr">' + esc(t('source')) + ': ' + esc(d.src) + '</div></div>';
      });
    });
  } else {
    s += '<input class="search" id="nameQ" type="search" placeholder="' + esc(t('searchNames')) + '" value="' + esc(nameQ) + '"><div class="card" id="nameList"></div>';
  }
  $('#v-duas').innerHTML = s;
  if (duaTab === 'names') { renderNameList(); $('#nameQ').addEventListener('input', e => { nameQ = e.target.value; renderNameList(); }); }
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

/* ---------- settings ---------- */
function stepper(path, val, min, max) {
  return '<span class="step"><button data-step="' + path + '" data-d="-1" data-min="' + min + '" data-max="' + max + '" aria-label="-">−</button><b>' + nA(val) + '</b><button data-step="' + path + '" data-d="1" data-min="' + min + '" data-max="' + max + '" aria-label="+">+</button></span>';
}
function toggle(path, on, dis) { return '<label class="sw"><input type="checkbox" data-set="' + path + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><i></i></label>'; }
function select(path, val, opts) { return '<select data-set="' + path + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>'; }

function renderSettings() {
  const prev = $('#sheet').scrollTop;
  const notifSupported = 'Notification' in window;
  const perm = notifSupported ? Notification.permission : 'denied';
  const cityOpts = [['__auto', t('locAuto')]].concat(D.CITIES.map(c => [c[0], c[0]]));
  const curCity = S.loc.auto ? '__auto' : (D.CITIES.find(c => c[0] === S.loc.name) ? S.loc.name : '__auto');
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
    '<div class="r"><span>' + esc(t('locManual')) + '</span>' + select('city', curCity, cityOpts) + '</div></div>';

  s += '<div class="set"><div class="st">' + esc(t('timesTitle')) + '</div>' +
    '<div class="r"><span>' + esc(t('setMethod')) + '</span>' + select('method', S.method, [['MWL', 'Muslim World League'], ['UOIF', 'UOIF (France)'], ['EGYPT', 'Egyptian Authority'], ['KARACHI', 'Karachi'], ['ISNA', 'ISNA'], ['UMM', 'Umm al-Qura']]) + '</div>' +
    '<div class="r"><span>' + esc(t('setAsr')) + '</span>' + select('asr', S.asr, [[1, t('asrStd')], [2, t('asrHanafi')]]) + '</div>' +
    '<div class="r"><span>' + esc(t('setImsak')) + '</span>' + stepper('imsakMin', S.imsakMin, 0, 60) + '</div>';
  ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => { s += '<div class="r"><span>' + esc(t(k)) + ' <small>' + esc(t('setAdjust')) + '</small></span>' + stepper('adj.' + k, S.adj[k], -30, 30) + '</div>'; });
  s += '<div class="r"><span>' + esc(t('setHijriAdj')) + '</span>' + stepper('hijriAdj', S.hijriAdj, -2, 2) + '</div>' +
    '<div class="r"><span>' + esc(t('setHijriMaghrib')) + '</span>' + toggle('hijriMaghrib', S.hijriMaghrib) + '</div></div>';

  s += '<div class="set"><div class="st">' + esc(t('setNotif')) + '</div>' +
    '<div class="r"><span>' + esc(perm === 'granted' && S.notif ? t('notifOn') : t('notifEnable')) + (perm === 'denied' && notifSupported ? '<small>' + esc(t('notifBlocked')) + '</small>' : '') + '</span>' + (perm === 'granted' && S.notif ? toggle('notifOff', true) : '<button class="btn sm" data-act="notifOn"' + (notifSupported && perm !== 'denied' ? '' : ' disabled') + '>' + esc(t('notifEnable')) + '</button>') + '</div>' +
    '<div class="r"><span>' + esc(t('setSound')) + '</span>' + select('sound', S.sound, [['chime', t('soundChime')], ['file', t('soundFile')], ['off', t('soundOff')]]) + '</div>' +
    '<div class="r"><span>' + esc(t('soundFile')) + '</span><span class="btns" style="margin:0"><label class="btn sm" style="cursor:pointer">' + esc(t('soundChoose')) + '<input type="file" accept="audio/*" id="adhanFile" hidden></label><button class="btn sm" data-act="soundTest">' + esc(t('soundTest')) + '</button></span></div>' +
    '<div class="r"><span>' + esc(t('setWake')) + '</span>' + toggle('wake', S.wake, !('wakeLock' in navigator)) + '</div></div>';

  s += '<div class="btns"><button class="btn danger" data-act="resetAll">' + esc(t('reset')) + '</button></div>';
  openSheet(s, prev);
  const f = $('#adhanFile');
  if (f) f.addEventListener('change', async () => {
    const file = f.files && f.files[0]; if (!file) return;
    try { await idbSet('adhan', file); S.sound = 'file'; save(); adhanUrl = null; toast(t('soundSaved')); renderSettings(); } catch (e) { toast('Could not save the file'); }
  });
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
  if (path === 'wake') applyWake();
  renderAll(true);
  if (!$('#sheet').hidden && !$('#rtForm')) renderSettings();
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
  setTimeout(() => el.remove(), opts.ms || 3800);
}

/* ---------- language, wake lock ---------- */
function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('appName');
}
let wl = null;
async function applyWake() {
  try {
    if (S.wake && 'wakeLock' in navigator && document.visibilityState === 'visible') { wl = await navigator.wakeLock.request('screen'); }
    else if (wl) { await wl.release(); wl = null; }
  } catch (e) { /* not allowed */ }
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
async function playSound(kind) {
  if (S.sound === 'off') return;
  if (S.sound === 'file' && kind === 'adhan') {
    try {
      if (!adhanUrl) { const b = await idbGet('adhan'); if (b) adhanUrl = URL.createObjectURL(b); }
      if (adhanUrl) { if (!aud) aud = new Audio(); aud.src = adhanUrl; aud.currentTime = 0; await aud.play(); toast(t('soundTest'), { action: t('stop'), onAction: stopSound, ms: 20000 }); return; }
    } catch (e) { /* fall back */ }
  }
  chime();
}
function stopSound() { if (aud) { aud.pause(); aud.currentTime = 0; } }
function unlockAudio() {
  audioCtx();
  if (S.sound === 'file') {
    idbGet('adhan').then(b => {
      if (!b) return;
      adhanUrl = URL.createObjectURL(b); aud = new Audio(adhanUrl); aud.muted = true;
      aud.play().then(() => { aud.pause(); aud.muted = false; aud.currentTime = 0; }).catch(() => { aud.muted = false; });
    }).catch(() => {});
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
}
function fireAlert(it, at) {
  const label = itemLabel(it);
  const title = t('timeFor') + ' ' + label;
  const dua = it.dua ? D.DUAS.find(d => d.id === it.dua) : null;
  const body = dua ? dua.ar : (it.fast ? t('fastAlertBody') : fmtHM(at));
  toast(title, { big: true, ms: 9000, action: aud && !aud.paused ? t('stop') : null, onAction: stopSound });
  playSound(it.adhan ? 'adhan' : 'chime');
  if (S.notif && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'asma-' + it.id, renotify: true, lang: S.lang, dir: S.lang === 'ar' ? 'rtl' : 'ltr' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { /* ignore */ } });
    else try { new Notification(title, opts); } catch (e) { /* ignore */ }
  }
}
async function enableNotif() {
  if (!('Notification' in window)) return;
  try {
    const p = await Notification.requestPermission();
    S.notif = p === 'granted'; save();
    if (S.notif) { toast(t('notifOn')); audioCtx(); }
  } catch (e) { /* ignore */ }
  renderSettings();
}

/* ---------- location and daily check ---------- */
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
    const fail = () => {
      const dk = window.asmaDesktop;
      if (dk && dk.ipLocation) {
        dk.ipLocation().then(p => {
          if (p && isFinite(p.lat) && isFinite(p.lng)) done(p.lat, p.lng);
          else { if (manual) toast(t('locFail')); resolve(false); }
        }).catch(() => { if (manual) toast(t('locFail')); resolve(false); });
      } else { if (manual) toast(t('locFail')); resolve(false); }
    };
    /* the desktop app has no OS location service, so it uses the network location instead */
    if (window.asmaDesktop) return fail();
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(pos => done(pos.coords.latitude, pos.coords.longitude), fail, { timeout: 12000, maximumAge: 6 * 3600 * 1000 });
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
}

/* ---------- routing ---------- */
function renderTab(tab) {
  if (tab === 'clock') renderClockView();
  else if (tab === 'prayer') renderPrayer();
  else if (tab === 'calendar') renderCalendar();
  else if (tab === 'routine') renderRoutine();
  else if (tab === 'duas') renderDuas();
}
function showTab(tab) {
  S.tab = tab; save();
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
  renderNavLabels();
  renderTab(tab);
  window.scrollTo(0, 0);
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
    case 'rtReset': S.routine = clone(D.ROUTINE); save(); firedKeys.clear(); renderRoutine(); break;
    case 'duaTab': duaTab = b.dataset.v; renderDuas(); break;
    case 'locUpdate': refreshLocation(true).then(() => { if (!$('#sheet').hidden) renderSettings(); }); break;
    case 'notifOn': enableNotif(); break;
    case 'soundTest': unlockAudio(); S.sound === 'off' ? toast(t('soundOff')) : playSound('adhan'); break;
    case 'resetAll': try { localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } S = load(); invalidate(); applyLang(); closeSheet(); showTab('clock'); break;
    default: break;
  }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.rton) {
    const it = S.routine.find(x => x.id === el.dataset.rton); if (it) { it.on = el.checked; save(); if (el.checked) { audioCtx(); } } return;
  }
  const path = el.dataset && el.dataset.set; if (!path) return;
  if (path === 'city') {
    if (el.value === '__auto') { S.loc.auto = true; refreshLocation(true); }
    else { const c = D.CITIES.find(x => x[0] === el.value); if (c) { S.loc = { auto: false, lat: c[1], lng: c[2], name: c[0] }; S.fresh = false; } }
    invalidate(); afterSetting('loc'); return;
  }
  if (path === 'notifOff') { S.notif = false; save(); renderSettings(); return; }
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (['asr', 'weekStart'].includes(path)) v = parseInt(v, 10);
  setPath(path, v); afterSetting(path);
});

document.addEventListener('pointerdown', function once() { unlockAudio(); document.removeEventListener('pointerdown', once); }, { once: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dailyCheck(false); applyWake(); lastSec = -1; tick(true); } });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- start ---------- */
applyLang();
showTab(S.tab || 'clock');
dailyCheck(false);
if (S.fresh && S.loc.auto) { refreshLocation(false); }
applyWake();
setInterval(() => tick(false), 250);
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
window.__asma = { S: () => S, tick: () => tick(true), fire: id => { const it = S.routine.find(x => x.id === id); if (it) fireAlert(it, new Date()); } };
})();
