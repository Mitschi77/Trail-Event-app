/* NORTHBOUND startup splash: static brand mark, full viewport and non-blocking cloud sync. */
(() => {
  'use strict';
  const splash = document.getElementById('northboundStartupSplash');
  if (!splash) return;

  document.documentElement.classList.add('northbound-startup-lock');
  document.body.classList.add('northbound-startup-lock');

  // Cover the complete iPhone viewport, including the bottom edge.
  Object.entries({
    position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
    width: '100vw', height: '100dvh', minHeight: '100vh', maxHeight: 'none',
    boxSizing: 'border-box', overflow: 'hidden', zIndex: '2147483647', transform: 'none'
  }).forEach(([property, value]) => splash.style.setProperty(
    property.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value, 'important'
  ));

  // Logo only: athlete artwork and animation are disabled while startup is simplified.
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

  // Start cloud synchronization in the background. A logged-out user, slow
  // network or unavailable Supabase must never hold the app behind the splash.
  try {
    if (typeof window.connectPlannerCloud === 'function') {
      Promise.resolve(window.connectPlannerCloud()).catch(error => {
        console.warn('NORTHBOUND: background cloud sync did not finish successfully.', error);
      });
    }
  } catch (error) {
    console.warn('NORTHBOUND: background cloud sync could not start.', error);
  }

  // Allow the static logo a brief first paint, then show the locally available app.
  window.setTimeout(finish, 300);
})();
