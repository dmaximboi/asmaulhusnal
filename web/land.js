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
      kicker: 'Free Islamic clock',
      get: 'Get the app',
      navNames: 'Names',
      navPrayer: 'Prayer',
      navIsland: 'Island',
      navSoon: 'Soon',
      heroAr: 'أسماء الله الحسنى',
      secNamesK: 'The dial',
      secNamesH: 'Ninety-nine Names, one sweep of the second hand',
      secNamesP: 'The analog face is the same clock as in the app. Each second lights the next Name. Allah sits at the centre. Grey names have already passed this minute.',
      secPrayK: 'Prayer times',
      secPrayH: 'Five times, next prayer, Qibla',
      secPrayP: 'Muslim World League by default. Location on the phone. Adhan can fire at Fajr, Dhuhr, Asr, Maghrib and Isha when you allow notifications.',
      next: 'Next',
      fajr: 'Fajr',
      dhuhr: 'Dhuhr',
      asr: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha',
      qibla: 'Qibla',
      secFastK: 'Fasting',
      secFastH: 'Suhoor, iftar, and a Maghrib notice',
      secFastP: 'Mark Fasting today. The phone keeps a stay notification, then at Maghrib sends a notice that Allah accept the fast, with the iftar dua. Source: Abu Dawud.',
      fastTitle: 'May Allah accept your fasting',
      iftarSrc: 'Abu Dawud',
      secDuaK: 'Duas',
      secDuaH: 'Sourced duas, on a schedule',
      secDuaP: 'Twenty minutes after Fajr a dua from the list is sent as a notice. On Friday at Dhuhr the app reminds you to read Surat al-Kahf. Routine items can be duas you pick. Nothing is invented. Each card cites its source.',
      wake: 'Upon waking',
      wakeEn: 'All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.',
      secIslK: 'Island',
      secIslH: 'A light pill over other apps',
      secIslP: 'On Android, allow display over other apps. The island stays a small pill until you touch it. If you do not, it waits three seconds, then folds back. Windows has the same island window.',
      nextPrayerLine: 'Next Dhuhr in 42 min',
      secWidK: 'Home widget',
      secWidH: 'The same dial on the home screen',
      secWidP: 'A compact 2 by 2 tile. Live 99 Names face, digital time, Arabic day and date underneath. Add it from Settings, then pin widget.',
      arDate: 'الجمعة ٢٦ نوفمبر',
      secCalK: 'Calendar',
      secCalH: 'Hijri day that turns at Maghrib',
      secCalP: 'Gregorian and Hijri sit together. You can shift the Hijri day by one if your local moon sighting differs. Events stay on the month view.',
      d0: 'Sat', d1: 'Sun', d2: 'Mon', d3: 'Tue', d4: 'Wed', d5: 'Thu', d6: 'Fri',
      secRtK: 'Routine',
      secRtH: 'Pray, dua, or a reminder you write',
      secRtP: 'Build a day around the five prayers. Attach a sourced dua. The Android alarms keep the time even when the app is closed.',
      rtDua: 'Dua after Fajr',
      kahf: 'Read al-Kahf',
      fri: 'Friday',
      secLearnK: 'Learn',
      secLearnH: 'How to pray, roots, a letter dictionary',
      secLearnP: 'Faceless diagrams for salah. Lessons on fasting and adhkar. A dictionary by Arabic letter. Roots start small and grow. Games and extra audio come later, still free at the core.',
      pill1: 'Salah steps', pill2: 'Adhkar', pill3: 'Dictionary', pill4: 'Roots', pill5: 'EN FR AR',
      secSoonK: 'More to come',
      secSoonH: 'The clock is the start',
      secSoonP: 'Next in line: a fuller Roots library, free games that never turn Names into scores, adhan voices, and optional packs. The clock, prayer times, adhan, fasting, calendar, basic duas, routine and basic Learn stay free.',
      soon1H: 'Roots', soon1P: 'More Arabic roots, quiz and review.',
      soon2H: 'Games', soon2P: 'Practice without gambling or pictures of people.',
      soon3H: 'Audio', soon3P: 'Adhan voices and recitation packs.',
      soon4H: 'Ramadan kit', soon4P: 'A seasonal layer on the same quiet clock.',
      footH: 'Take it with you',
      owner: 'Asma Clock. Maxim, Digital26. Open source.'
    },
    fr: {
      title: 'Horloge Asma',
      lead: 'Une horloge sobre avec les 99 Noms, les heures de priere et un calendrier hijri.',
      apk: 'Telecharger Android',
      win: 'Telecharger Windows',
      open: 'Ouvrir dans ce navigateur',
      hint: 'Les fichiers telephone et Windows s ouvrent en un geste. Apres avoir ouvert l horloge dans le navigateur, utilise le menu du navigateur pour l installer sur l ecran d accueil.',
      kicker: 'Horloge islamique libre',
      get: 'Installer',
      navNames: 'Noms',
      navPrayer: 'Priere',
      navIsland: 'Ile',
      navSoon: 'Bientot',
      heroAr: 'أسماء الله الحسنى',
      secNamesK: 'Le cadran',
      secNamesH: 'Quatre-vingt-dix-neuf Noms, un tour de l aiguille des secondes',
      secNamesP: 'Le cadran analogique est le meme que dans l application. Chaque seconde eclaire le Nom suivant. Allah est au centre. Les noms gris sont deja passes dans cette minute.',
      secPrayK: 'Heures de priere',
      secPrayH: 'Cinq heures, prochaine priere, Qibla',
      secPrayP: 'Ligue islamique mondiale par defaut. Position sur le telephone. L adhan peut sonner a Fajr, Dhuhr, Asr, Maghrib et Isha si tu autorises les notifications.',
      next: 'Prochaine',
      fajr: 'Fajr',
      dhuhr: 'Dhuhr',
      asr: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha',
      qibla: 'Qibla',
      secFastK: 'Jeune',
      secFastH: 'Souhour, iftar, avis a Maghrib',
      secFastP: 'Coche Jeune aujourd hui. Le telephone garde une notification, puis a Maghrib envoie que Allah accepte le jeune, avec la dua d iftar. Source : Abu Dawud.',
      fastTitle: 'Qu Allah accepte ton jeune',
      iftarSrc: 'Abu Dawud',
      secDuaK: 'Douas',
      secDuaH: 'Douas sourcees, sur un horaire',
      secDuaP: 'Vingt minutes apres Fajr, une dua de la liste part en notification. Le vendredi a Dhuhr, l app rappelle de lire Surat al-Kahf. La routine peut porter une dua choisie. Rien n est invente. Chaque carte cite sa source.',
      wake: 'Au reveil',
      wakeEn: 'Louange a Allah qui nous a rendu la vie apres nous avoir fait mourir, et c est vers Lui la resurrection.',
      secIslK: 'Ile',
      secIslH: 'Une pastille legere au-dessus des autres apps',
      secIslP: 'Sur Android, autorise l affichage par-dessus les autres apps. L ile reste une pastille jusqu au toucher. Sans geste, elle attend trois secondes puis se replie. Windows a la meme fenetre.',
      nextPrayerLine: 'Dhuhr dans 42 min',
      secWidK: 'Widget',
      secWidH: 'Le meme cadran sur l ecran d accueil',
      secWidP: 'Une tuile 2 par 2. Cadran des 99 Noms, heure digitale, jour et date en arabe. Ajoute-la depuis Reglages, puis epingler le widget.',
      arDate: 'الجمعة ٢٦ نوفمبر',
      secCalK: 'Calendrier',
      secCalH: 'Le jour hijri change a Maghrib',
      secCalP: 'Gregorien et hijri ensemble. Tu peux decaler le jour hijri d un cran si la vision locale de la lune differe. Les evenements restent sur le mois.',
      d0: 'Sam', d1: 'Dim', d2: 'Lun', d3: 'Mar', d4: 'Mer', d5: 'Jeu', d6: 'Ven',
      secRtK: 'Routine',
      secRtH: 'Priere, dua, ou un rappel ecrit',
      secRtP: 'Construit la journee autour des cinq prieres. Attache une dua sourcee. Les alarmes Android gardent l heure meme si l app est fermee.',
      rtDua: 'Dua apres Fajr',
      kahf: 'Lire al-Kahf',
      fri: 'Vendredi',
      secLearnK: 'Apprendre',
      secLearnH: 'Prier, racines, dictionnaire par lettre',
      secLearnP: 'Schemas sans visages pour la salah. Lecons sur le jeune et les adhkar. Un dictionnaire par lettre arabe. Les racines commencent petites. Jeux et audio extra plus tard, le coeur reste libre.',
      pill1: 'Etapes de salah', pill2: 'Adhkar', pill3: 'Dictionnaire', pill4: 'Racines', pill5: 'EN FR AR',
      secSoonK: 'A venir',
      secSoonH: 'L horloge n est que le debut',
      secSoonP: 'Ensuite: une bibliotheque de racines plus large, des jeux libres qui ne transforment pas les Noms en scores, des voix d adhan, des packs optionnels. L horloge, les prieres, l adhan, le jeune, le calendrier, les duas de base, la routine et Apprendre de base restent libres.',
      soon1H: 'Racines', soon1P: 'Plus de racines arabes, quiz et revision.',
      soon2H: 'Jeux', soon2P: 'Sentrainer sans jeu d argent ni images de personnes.',
      soon3H: 'Audio', soon3P: 'Voix d adhan et recitation.',
      soon4H: 'Kit Ramadan', soon4P: 'Une couche de saison sur la meme horloge.',
      footH: 'Emporte-la',
      owner: 'Horloge Asma. Maxim, Digital26. Open source.'
    },
    ar: {
      title: 'ساعة الأسماء',
      lead: 'ساعة هادئة بأسماء الله الحسنى ومواقيت الصلاة والتقويم الهجري.',
      apk: 'تنزيل أندرويد',
      win: 'تنزيل ويندوز',
      open: 'فتح في هذا المتصفح',
      hint: 'ملفا الهاتف وويندوز بضغطة واحدة. بعد فتح الساعة في المتصفح استخدم قائمة المتصفح لتثبيتها على الشاشة الرئيسية.',
      kicker: 'ساعة إسلامية مجانية',
      get: 'حمّل التطبيق',
      navNames: 'الأسماء',
      navPrayer: 'الصلاة',
      navIsland: 'الجزيرة',
      navSoon: 'قريبا',
      heroAr: 'أسماء الله الحسنى',
      secNamesK: 'الميناء',
      secNamesH: 'تسعة وتسعون اسما، دورة عقرب الثواني',
      secNamesP: 'الميناء نفسه الذي في التطبيق. كل ثانية تضيء الاسم التالي. الله في الوسط. الأسماء الرمادية مرت في هذه الدقيقة.',
      secPrayK: 'مواقيت الصلاة',
      secPrayH: 'خمس صلوات، الصلاة التالية، القبلة',
      secPrayP: 'رابطة العالم الإسلامي افتراضيا. الموقع على الهاتف. يمكن للأذان أن يعمل في الفجر والظهر والعصر والمغرب والعشاء إن أذنت بالإشعارات.',
      next: 'التالي',
      fajr: 'الفجر',
      dhuhr: 'الظهر',
      asr: 'العصر',
      maghrib: 'المغرب',
      isha: 'العشاء',
      qibla: 'القبلة',
      secFastK: 'الصيام',
      secFastH: 'السحور والإفطار وتنبيه المغرب',
      secFastP: 'علّم صيام اليوم. يبقى إشعار على الهاتف، ثم عند المغرب يصل إشعار بقبول الصيام مع دعاء الإفطار. المصدر: أبو داود.',
      fastTitle: 'تقبّل الله صيامكم',
      iftarSrc: 'أبو داود',
      secDuaK: 'الأدعية',
      secDuaH: 'أدعية من مصادر، على مواعيد',
      secDuaP: 'بعد الفجر بعشرين دقيقة يُرسل دعاء من القائمة. يوم الجمعة عند الظهر يذكّر بقراءة سورة الكهف. يمكن لروتينك أن يحمل دعاء تختاره. لا اختراع للنصوص. كل بطاقة تذكر مصدرها.',
      wake: 'عند الاستيقاظ',
      wakeEn: 'الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور.',
      secIslK: 'الجزيرة',
      secIslH: 'حبّة خفيفة فوق التطبيقات',
      secIslP: 'على أندرويد اسمح بالعرض فوق التطبيقات. تبقى الجزيرة حبّة صغيرة حتى تلمسها. إن لم تلمس تنتظر ثلاث ثوان ثم تنطوي. ويندوز له النافذة نفسها.',
      nextPrayerLine: 'الظهر بعد ٤٢ دقيقة',
      secWidK: 'الودجة',
      secWidH: 'الميناء نفسه على الشاشة الرئيسية',
      secWidP: 'بلاطة ٢ في ٢. وجه الأسماء التسعة والتسعين، الوقت الرقمي، اليوم والتاريخ بالعربية. أضفها من الإعدادات ثم ثبّت الودجة.',
      arDate: 'الجمعة ٢٦ نوفمبر',
      secCalK: 'التقويم',
      secCalH: 'اليوم الهجري يتبدل عند المغرب',
      secCalP: 'الميلادي والهجري معا. يمكنك إزاحة اليوم الهجري يوما إن اختلفت رؤية الهلال. المناسبات تبقى على عرض الشهر.',
      d0: 'سبت', d1: 'أحد', d2: 'اثن', d3: 'ثلث', d4: 'أرب', d5: 'خميس', d6: 'جمعة',
      secRtK: 'الروتين',
      secRtH: 'صلاة أو دعاء أو تذكير تكتبه',
      secRtP: 'ابنِ يومك حول الصلوات الخمس. أرفق دعاء من مصدره. منبّهات أندرويد تحفظ الوقت ولو أغلقت التطبيق.',
      rtDua: 'دعاء بعد الفجر',
      kahf: 'اقرأ الكهف',
      fri: 'الجمعة',
      secLearnK: 'تعلّم',
      secLearnH: 'الصلاة والجذور ومعجم الحروف',
      secLearnP: 'رسوم بلا وجوه للصلاة. دروس في الصيام والأذكار. معجم حسب الحرف. الجذور تبدأ قليلة ثم تزيد. الألعاب والصوت لاحقا، والأساس يبقى مجانا.',
      pill1: 'خطوات الصلاة', pill2: 'أذكار', pill3: 'المعجم', pill4: 'جذور', pill5: 'EN FR AR',
      secSoonK: 'قريبا',
      secSoonH: 'الساعة هي البداية',
      secSoonP: 'بعد ذلك: مكتبة جذور أوسع، ألعاب حرة لا تجعل الأسماء نقاطا، أصوات أذان، وحزم اختيارية. الساعة والمواقيت والأذان والصيام والتقويم والأدعية الأساسية والروتين وتعلّم الأساسي تبقى مجانية.',
      soon1H: 'الجذور', soon1P: 'مزيد من الجذور العربية مع مراجعة.',
      soon2H: 'ألعاب', soon2P: 'تدريب بلا قمار وبلا صور ناس.',
      soon3H: 'صوت', soon3P: 'أصوات أذان وتلاوة.',
      soon4H: 'عدة رمضان', soon4P: 'طبقة موسمية على الساعة نفسها.',
      footH: 'خذها معك',
      owner: 'ساعة الأسماء. مكسيم، Digital26. مصدر مفتوح.'
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
    document.querySelectorAll('[data-t]').forEach(el => {
      const k = el.getAttribute('data-t');
      if (k && t[k]) el.textContent = t[k];
    });
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

  const dials = document.querySelectorAll('[data-dial]');
  if (window.AsmaDial) {
    dials.forEach(d => { d.innerHTML = window.AsmaDial.build(); });
    const loop = function () {
      dials.forEach(d => window.AsmaDial.frame(d));
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tickClocks() {
    const now = new Date();
    const full = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    document.querySelectorAll('[data-clock]').forEach(el => {
      el.textContent = el.classList.contains('w-time') || (el.parentElement && el.parentElement.classList.contains('isl-c'))
        ? hm
        : full;
    });
  }
  tickClocks();
  setInterval(tickClocks, 1000);

  const isl = document.getElementById('islDemo');
  if (isl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let open = false;
    setInterval(function () {
      open = !open;
      isl.classList.toggle('open', open);
    }, 3200);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.16 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }
})();
