(function () {
  const APK = 'https://github.com/dmaximboi/asmaulhusnal/releases/latest/download/asma-clock.apk';
  const WIN = 'https://github.com/dmaximboi/asmaulhusnal/releases/latest/download/Asma-Island-Setup.exe';
  const API = 'https://api.github.com/repos/dmaximboi/asmaulhusnal/releases/latest';
  const T = {
    en: {
      title: 'Asma Clock',
      lead: 'A quiet clock with the 99 Names, prayer times and a Hijri calendar.',
      apk: 'Download Android',
      win: 'Download Windows',
      open: 'Open in this browser',
      hint: 'The phone and Windows files are one tap. After you open the clock in the browser, use the browser menu to install the web app on the home screen.',
      wait: 'The file is prepared on the download page. If it is missing, wait a few minutes and try again.'
    },
    fr: {
      title: 'Horloge Asma',
      lead: 'Une horloge sobre avec les 99 Noms, les heures de priere et un calendrier hijri.',
      apk: 'Telecharger Android',
      win: 'Telecharger Windows',
      open: 'Ouvrir dans ce navigateur',
      hint: 'Les fichiers telephone et Windows s ouvrent en un geste. Apres avoir ouvert l horloge dans le navigateur, utilise le menu du navigateur pour l installer sur l ecran d accueil.',
      wait: 'Le fichier est prepare sur la page de telechargement. S il manque, attends quelques minutes.'
    },
    ar: {
      title: 'ساعة الأسماء',
      lead: 'ساعة هادئة بأسماء الله الحسنى ومواقيت الصلاة والتقويم الهجري.',
      apk: 'تنزيل أندرويد',
      win: 'تنزيل ويندوز',
      open: 'فتح في هذا المتصفح',
      hint: 'ملفا الهاتف وويندوز بضغطة واحدة. بعد فتح الساعة في المتصفح استخدم قائمة المتصفح لتثبيتها على الشاشة الرئيسية.',
      wait: 'يُجهَّز الملف في صفحة التنزيل. إن لم يظهر فانتظر قليلا ثم أعد المحاولة.'
    }
  };

  function savedLang() {
    try {
      const s = JSON.parse(localStorage.getItem('asma.v1') || '{}');
      if (s.lang === 'fr' || s.lang === 'ar' || s.lang === 'en') return s.lang;
    } catch (e) { /* ignore */ }
    const nl = (navigator.language || 'en').slice(0, 2);
    return nl === 'fr' || nl === 'ar' ? nl : 'en';
  }

  let lang = savedLang();

  function apply() {
    const t = T[lang] || T.en;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t.title;
    const h = document.getElementById('landTitle');
    const lead = document.getElementById('landLead');
    const apk = document.getElementById('dlApk');
    const win = document.getElementById('dlWin');
    const open = document.getElementById('openApp');
    const hint = document.getElementById('landHint');
    if (h) h.textContent = t.title;
    if (lead) lead.textContent = t.lead;
    if (apk) apk.textContent = t.apk;
    if (win) win.textContent = t.win;
    if (open) open.textContent = t.open;
    if (hint) hint.textContent = t.hint;
    document.querySelectorAll('[data-lang]').forEach(b => {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
  }

  function setHref(id, url) {
    const a = document.getElementById(id);
    if (a && url) a.setAttribute('href', url);
  }

  function pickAsset(assets, test) {
    if (!assets || !assets.length) return '';
    for (let i = 0; i < assets.length; i++) {
      const n = (assets[i].name || '').toLowerCase();
      if (test(n) && assets[i].browser_download_url) return assets[i].browser_download_url;
    }
    return '';
  }

  setHref('dlApk', APK);
  setHref('dlWin', WIN);

  fetch('version.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
    const el = document.getElementById('landVer');
    if (el && j && (j.apkName || j.apkCode)) el.textContent = (j.apkName ? 'v' + j.apkName : '') + (j.apkCode ? '  ·  ' + j.apkCode : '');
  }).catch(() => {});

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.assets) return;
    const apk = pickAsset(j.assets, n => n.indexOf('.apk') >= 0);
    const win = pickAsset(j.assets, n => n.indexOf('.exe') >= 0 || n.indexOf('setup') >= 0);
    if (apk) setHref('dlApk', apk);
    if (win) setHref('dlWin', win);
  }).catch(() => {});

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-lang]');
    if (!b) return;
    lang = b.getAttribute('data-lang') || 'en';
    try {
      const s = JSON.parse(localStorage.getItem('asma.v1') || '{}');
      s.lang = lang;
      localStorage.setItem('asma.v1', JSON.stringify(s));
    } catch (e) { /* ignore */ }
    apply();
  });

  apply();
  if (location.hash === '#download') {
    const box = document.getElementById('download');
    if (box && box.scrollIntoView) box.scrollIntoView();
  }

  function tickHands() {
    const hour = document.getElementById('landHour');
    const min = document.getElementById('landMin');
    const sec = document.getElementById('landSec');
    if (!hour || !min || !sec) return;
    const n = new Date();
    const s = n.getSeconds() + n.getMilliseconds() / 1000;
    const m = n.getMinutes() + s / 60;
    const h = (n.getHours() % 12) + m / 60;
    hour.setAttribute('transform', 'rotate(' + (h * 30) + ' 50 50)');
    min.setAttribute('transform', 'rotate(' + (m * 6) + ' 50 50)');
    sec.setAttribute('transform', 'rotate(' + (s * 6) + ' 50 50)');
  }
  tickHands();
  setInterval(tickHands, 80);
})();
