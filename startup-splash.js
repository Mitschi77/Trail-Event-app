/* NORTHBOUND startup splash: static brand mark, full iPhone viewport and safe cloud handoff. */
(() => {
  'use strict';
  const splash = document.getElementById('northboundStartupSplash');
  if (!splash) return;

  document.documentElement.classList.add('northbound-startup-lock');
  document.body.classList.add('northbound-startup-lock');

  // Explicit viewport dimensions cover the full iPhone screen, including its bottom edge.
  Object.entries({
    position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
    width: '100vw', height: '100dvh', minHeight: '100vh', maxHeight: 'none',
    boxSizing: 'border-box', overflow: 'hidden', zIndex: '2147483647', transform: 'none'
  }).forEach(([property, value]) => splash.style.setProperty(
    property.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value, 'important'
  ));

  // Keep only the NORTHBOUND logo on the splash. Athlete artwork and animation
  // are disabled completely for now to reduce startup work and isolate delays.
  const style = document.createElement('style');
  style.id = 'northbound-splash-static-brand';
  style.textContent = `
    html.northbound-startup-lock,html.northbound-startup-lock body{
      overflow:hidden!important;overscroll-behavior:none!important
    }
    body.northbound-startup-lock{position:relative!important}
    #northboundStartupSplash .nb-splash-athlete{
      display:none!important;visibility:hidden!important;animation:none!important
    }
  `;
  document.head.appendChild(style);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    splash.classList.add('is-leaving');
    document.documentElement.classList.remove('northbound-startup-lock');
    document.body.classList.remove('northbound-startup-lock');
    window.setTimeout(() => splash.remove(), 420);
  };

  const boot = async () => {
    try {
      if (typeof window.connectPlannerCloud === 'function') {
        await window.connectPlannerCloud();
      }
    } catch (error) {
      console.warn('NORTHBOUND: initial cloud sync did not finish successfully.', error);
    } finally {
      finish();
    }
  };

  void boot();
})();
