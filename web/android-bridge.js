/* Present only when the Android overlay injects AsmaBridge. No-op in the browser. */
(function () {
  const n = window.AsmaBridge;
  if (!n) return;
  try {
    const raw = n.storeJson && n.storeJson();
    if (raw) {
      window.__ASMA_STORE = JSON.parse(raw);
      try { localStorage.setItem('asma.v1', raw); } catch (e) { /* file origin */ }
    }
  } catch (e) { /* ignore */ }
  window.asmaDesktop = {
    ignore: function (v) { try { n.ignore(!!v); } catch (e) { /* ignore */ } },
    show: function () { try { n.show(); } catch (e) { /* ignore */ } },
    openApp: function () { try { n.openApp(); } catch (e) { /* ignore */ } },
    holdAwake: function (on) { try { n.holdAwake(!!on); } catch (e) { /* ignore */ } },
    resize: function (mode, page) { try { n.resize(String(mode || ''), page | 0); } catch (e) { /* ignore */ } },
    cursor: function () { return Promise.resolve({ x: -999, y: -999 }); },
    ipLocation: function () { return Promise.resolve(null); }
  };
})();
