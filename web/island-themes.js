/* Deep island palettes. Shared by the island, Settings, Android overlay. */
(function () {
  const list = [
    { id: 'black', bg: '#070707', line: '#2a2a28', fg: '#f4f4f1', mut: '#8f8f8a', acc: '#d6df8c', tile: '#121212',
      name: { en: 'Deep black', fr: 'Noir profond', ar: 'أسود عميق' } },
    { id: 'navy', bg: '#061428', line: '#1a3355', fg: '#e8f0ff', mut: '#7a93b3', acc: '#7eb6ff', tile: '#0a1c36',
      name: { en: 'Deep blue', fr: 'Bleu profond', ar: 'أزرق عميق' } },
    { id: 'gold', bg: '#1a1404', line: '#5c4a12', fg: '#f8efd0', mut: '#b39b5a', acc: '#e6c35c', tile: '#261c08',
      name: { en: 'Deep gold', fr: 'Or profond', ar: 'ذهبي عميق' } },
    { id: 'orange', bg: '#1a0c04', line: '#5c2e12', fg: '#fde8d8', mut: '#c48960', acc: '#e07a3a', tile: '#261208',
      name: { en: 'Deep orange', fr: 'Orange profond', ar: 'برتقالي عميق' } },
    { id: 'teal', bg: '#041614', line: '#14524a', fg: '#dff7f3', mut: '#6aa39a', acc: '#2aa89a', tile: '#082420',
      name: { en: 'Deep teal', fr: 'Sarcelle profonde', ar: 'تيل عميق' } },
    { id: 'coffee', bg: '#1a100c', line: '#4a3228', fg: '#f3e6d8', mut: '#b08970', acc: '#c4a07a', tile: '#261810',
      name: { en: 'Deep coffee', fr: 'Cafe profond', ar: 'قهوة عميقة' } },
    { id: 'chocolate', bg: '#140a08', line: '#3d2218', fg: '#f0ddd0', mut: '#a67a62', acc: '#a36b45', tile: '#1e100c',
      name: { en: 'Deep chocolate', fr: 'Chocolat profond', ar: 'شوكولا عميق' } },
    { id: 'forest', bg: '#08140c', line: '#1e3d28', fg: '#e4f5e8', mut: '#6a9a74', acc: '#6fbf7a', tile: '#0e1e14',
      name: { en: 'Deep forest', fr: 'Foret profonde', ar: 'غابة عميقة' } },
    { id: 'plum', bg: '#140814', line: '#3d1e3d', fg: '#f6e8f8', mut: '#a078a8', acc: '#c989d4', tile: '#1e0c1e',
      name: { en: 'Deep plum', fr: 'Prune profonde', ar: 'برقوقي عميق' } },
    { id: 'wine', bg: '#14060a', line: '#4a1824', fg: '#fde8ee', mut: '#b07080', acc: '#d46a7e', tile: '#220c12',
      name: { en: 'Deep wine', fr: 'Vin profond', ar: 'خمري عميق' } }
  ];
  function get(id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function apply(id, root) {
    const t = get(id);
    const el = root || document.documentElement;
    el.style.setProperty('--isl-bg', t.bg);
    el.style.setProperty('--isl-tile', t.tile);
    el.style.setProperty('--acc', t.acc);
    el.style.setProperty('--mut', t.mut);
    el.style.setProperty('--fg', t.fg);
    el.style.setProperty('--line', t.line);
    el.setAttribute('data-island-theme', t.id);
  }
  window.AsmaIslandThemes = { list: list, get: get, apply: apply };
})();
