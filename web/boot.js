/* Send installed shells to the clock. Browser visitors stay on the landing page. */
(function () {
  function isInstalledShell() {
    try {
      if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return true;
    } catch (e) { /* ignore */ }
    if (typeof navigator !== 'undefined' && navigator.standalone) return true;
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    }
    if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '')) return true;
    return false;
  }
  if (isInstalledShell()) {
    location.replace('app.html');
    return;
  }
  document.documentElement.classList.add('land-ready');
})();
