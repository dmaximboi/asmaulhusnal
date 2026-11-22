/* Node test for web/core.js prayer times.
   Expected values supplied by the owner (PrayTimes-style, two iterations).
   core.js uses one sun-position pass, so times may differ by 1 minute. */

'use strict';

const assert = require('assert');
const core = require('../web/core.js');

function pad(n) { return (n < 10 ? '0' : '') + n; }
function hm(date) {
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function minutes(hhmm) {
  const p = hhmm.split(':');
  return (+p[0]) * 60 + (+p[1]);
}

const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const TOL_MIN = 1;

const CASES = [
  {
    name: 'Lagos',
    tz: 'Africa/Lagos',
    y: 2026, m: 3, d: 1,
    cfg: { lat: 6.5244, lng: 3.3792, method: 'MWL', asr: 1 },
    expect: { fajr: '05:49', sunrise: '06:59', dhuhr: '12:59', asr: '16:17', maghrib: '18:59', isha: '20:04' }
  },
  {
    name: 'Cairo',
    tz: 'Africa/Cairo',
    y: 2026, m: 11, d: 22,
    cfg: { lat: 30.0444, lng: 31.2357, method: 'EGYPT', asr: 2 },
    expect: { fajr: '04:55', sunrise: '06:26', dhuhr: '11:41', asr: '15:19', maghrib: '16:56', isha: '18:17' }
  },
  {
    name: 'Jakarta',
    tz: 'Asia/Jakarta',
    y: 2026, m: 5, d: 15,
    cfg: { lat: -6.2088, lng: 106.8456, method: 'MWL', asr: 1 },
    expect: { fajr: '04:41', sunrise: '05:54', dhuhr: '11:49', asr: '15:11', maghrib: '17:44', isha: '18:53' }
  }
];

let failed = 0;
CASES.forEach(c => {
  process.env.TZ = c.tz;
  const got = core.dayTimes(c.y, c.m, c.d, c.cfg);
  KEYS.forEach(k => {
    const actual = hm(got[k]);
    const diff = Math.abs(minutes(actual) - minutes(c.expect[k]));
    try {
      assert.ok(diff <= TOL_MIN, c.name + ' ' + k + ': got ' + actual + ', expected ' + c.expect[k] + ' (max ' + TOL_MIN + ' min)');
      console.log('ok  ' + c.name + ' ' + k + ' ' + actual + (diff ? ' (owner ' + c.expect[k] + ')' : ''));
    } catch (e) {
      failed++;
      console.error('fail ' + e.message);
    }
  });
});

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('All prayer-time checks passed (tolerance ' + TOL_MIN + ' min).');
