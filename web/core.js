/* Calculation core: prayer times, Hijri dates, Qibla, number helpers. No DOM access. */
(function (root) {
'use strict';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R), tan = d => Math.tan(d * D2R);
const asin = x => Math.asin(x) * R2D, acos = x => Math.acos(x) * R2D;
const atan2 = (y, x) => Math.atan2(y, x) * R2D, acot = x => Math.atan(1 / x) * R2D;
const fixAngle = a => a - 360 * Math.floor(a / 360);
const fixHour = a => a - 24 * Math.floor(a / 24);

const METHODS = {
  MWL:    {fajr:18,   isha:17},
  UOIF:   {fajr:12,   isha:12},
  EGYPT:  {fajr:19.5, isha:17.5},
  KARACHI:{fajr:18,   isha:18},
  ISNA:   {fajr:15,   isha:15},
  UMM:    {fajr:18.5, ishaMin:90}
};

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPos(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(atan2(cos(e) * sin(L), cos(L)) / 15);
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
}

/* Local clock hours for one civil day. tz = UTC offset in hours. */
function rawHours(y, m, d, lat, lng, tz, methodKey, asrFactor) {
  const p = METHODS[methodKey] || METHODS.MWL;
  const jd = julian(y, m, d) - lng / (15 * 24);
  const mid = t => fixHour(12 - sunPos(jd + t).eqt);
  const sat = (angle, t, ccw) => {
    const dec = sunPos(jd + t).decl;
    const v = (-sin(angle) - sin(dec) * sin(lat)) / (cos(dec) * cos(lat));
    if (v < -1 || v > 1) return NaN;
    return mid(t) + (ccw ? -1 : 1) * acos(v) / 15;
  };
  const asr = (f, t) => {
    const dec = sunPos(jd + t).decl;
    return sat(-acot(f + tan(Math.abs(lat - dec))), t, false);
  };
  const shift = tz - lng / 15;
  const fajr = sat(p.fajr, 5 / 24, true) + shift;
  const sunrise = sat(0.833, 6 / 24, true) + shift;
  const dhuhr = mid(12 / 24) + shift;
  const asrT = asr(asrFactor || 1, 13 / 24) + shift;
  const sunset = sat(0.833, 18 / 24, false) + shift;
  const maghrib = sunset;
  const isha = p.ishaMin ? maghrib + p.ishaMin / 60 : sat(p.isha, 18 / 24, false) + shift;
  return { fajr, sunrise, dhuhr, asr: asrT, maghrib, isha };
}

function tzOf(y, m, d) { return -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60; }
function atHour(y, m, d, h, tz) { return Date.UTC(y, m - 1, d) + (h - tz) * 3600000; }

/* cfg: {lat,lng,method,asr,adj:{fajr,sunrise,dhuhr,asr,maghrib,isha},imsakMin}. Returns Date objects. */
function dayTimes(y, m, d, cfg) {
  const adj = cfg.adj || {};
  const build = (yy, mm, dd) => {
    const tz = tzOf(yy, mm, dd);
    const h = rawHours(yy, mm, dd, cfg.lat, cfg.lng, tz, cfg.method, cfg.asr);
    const o = {};
    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
      o[k] = atHour(yy, mm, dd, h[k], tz) + (adj[k] || 0) * 60000;
    });
    return o;
  };
  const t = build(y, m, d);
  const yd = new Date(y, m - 1, d - 1);
  const prev = build(yd.getFullYear(), yd.getMonth() + 1, yd.getDate());
  const night = t.fajr - prev.maghrib;
  const out = {
    imsak: t.fajr - (cfg.imsakMin == null ? 10 : cfg.imsakMin) * 60000,
    fajr: t.fajr, sunrise: t.sunrise, duha: t.sunrise + 20 * 60000,
    dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha,
    midnight: prev.maghrib + night / 2, tahajjud: prev.maghrib + night * 2 / 3
  };
  Object.keys(out).forEach(k => { out[k] = new Date(out[k]); });
  return out;
}

/* ---------- Hijri ---------- */
let hFmt = null, hMode = null;
function initHijri() {
  if (hMode) return;
  try {
    hFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    hMode = hFmt.resolvedOptions().calendar === 'islamic-umalqura' ? 'intl' : 'arith';
  } catch (e) { hMode = 'arith'; }
}
function hijriArith(y, m, d) {
  const jd = Math.floor(julian(y, m, d) + 0.5);
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor(50 * l / 17719) + Math.floor(l / 5670) * Math.floor(43 * l / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
  const mo = Math.floor(24 * l / 709);
  const da = l - Math.floor(709 * mo / 24);
  return { y: 30 * n + j - 30, m: mo, d: da };
}
/* date: any Date. adjDays shifts the civil day first. Uses the local civil Y/M/D. */
function hijri(date, adjDays) {
  initHijri();
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (adjDays || 0), 12);
  if (hMode === 'intl') {
    const o = {};
    hFmt.formatToParts(base).forEach(p => { o[p.type] = p.value; });
    const y = parseInt(o.year, 10), m = parseInt(o.month, 10), d = parseInt(o.day, 10);
    if (y && m && d) return { y, m, d };
  }
  return hijriArith(base.getFullYear(), base.getMonth() + 1, base.getDate());
}

/* ---------- misc ---------- */
function qibla(lat, lng) {
  const kLat = 21.4225, kLng = 39.8262, dL = (kLng - lng) * D2R;
  const y = Math.sin(dL);
  const x = Math.cos(lat * D2R) * Math.tan(kLat * D2R) - Math.sin(lat * D2R) * Math.cos(dL);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}
function distKm(a, b, c, d) {
  const R = 6371, dLat = (c - a) * D2R, dLng = (d - b) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * D2R) * Math.cos(c * D2R) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAr = s => String(s).replace(/\d/g, d => AR_DIGITS[d]);
const pad = n => (n < 10 ? '0' : '') + n;
function fmtDur(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
}

const api = { METHODS, dayTimes, hijri, qibla, distKm, toAr, pad, fmtDur, julian };
root.AsmaCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
