/* Shared 99 Names dial. Used by the clock tab and the landing page. */
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function geo() {
    const names = window.NAMES || [];
    return names.map((n, i) => {
      const a = (i + 0.5) * 360 / 99, flip = a > 180;
      return { tf: 'rotate(' + (flip ? a + 90 : a - 90).toFixed(3) + ')', x: flip ? -224 : 224, an: flip ? 'start' : 'end' };
    });
  }
  function build() {
    const names = window.NAMES || [];
    const GEO = geo();
    let s = '<svg viewBox="-250 -250 500 500" role="img" aria-label="99 Names of Allah clock">';
    s += '<circle r="249" fill="#101010"/><circle r="243" fill="#f4f4f1"/><circle r="231" fill="none" stroke="#e1e1dc" stroke-width=".6"/>';
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, a = i * 6;
      s += '<line x1="0" y1="-' + (big ? 232 : 236) + '" x2="0" y2="-241" stroke="' + (big ? '#222' : '#9a9a96') + '" stroke-width="' + (big ? 1.4 : .7) + '" transform="rotate(' + a + ')"/>';
    }
    s += '<g id="names">';
    names.forEach((n, i) => {
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
  function updateNames(root, idx) {
    if (!root) return;
    const GEO = geo();
    const names = root.querySelectorAll('#names .nm');
    names.forEach((n, i) => { n.setAttribute('class', i < idx ? 'nm done' : 'nm'); });
    const hl = root.querySelector('#hlT');
    const g = GEO[idx];
    const list = window.NAMES || [];
    if (!hl || !g || !list[idx]) return;
    hl.textContent = list[idx][0];
    hl.setAttribute('transform', g.tf);
    hl.setAttribute('x', g.x);
    hl.setAttribute('y', 0);
    hl.setAttribute('text-anchor', g.an);
  }
  function frame(root) {
    if (!root) return -1;
    const now = new Date();
    const sf = now.getSeconds() + now.getMilliseconds() / 1000;
    const sh = root.querySelector('#sHand'), mh = root.querySelector('#mHand'), hh = root.querySelector('#hHand');
    if (!sh || !mh || !hh) return -1;
    sh.setAttribute('transform', 'rotate(' + (sf * 6).toFixed(2) + ')');
    mh.setAttribute('transform', 'rotate(' + ((now.getMinutes() + sf / 60) * 6).toFixed(2) + ')');
    hh.setAttribute('transform', 'rotate(' + (((now.getHours() % 12) + now.getMinutes() / 60) * 30).toFixed(2) + ')');
    const idx = Math.min(98, Math.floor(sf / 60 * 99));
    if (String(root.getAttribute('data-idx')) !== String(idx)) {
      root.setAttribute('data-idx', String(idx));
      updateNames(root, idx);
    }
    return idx;
  }
  window.AsmaDial = { build: build, frame: frame };
})();
