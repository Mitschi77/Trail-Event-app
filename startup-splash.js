/* NORTHBOUND startup splash: keep the app covered until the initial cloud check finishes. */
(() => {
  'use strict';

  const splash = document.getElementById('northboundStartupSplash');
  if (!splash) return;

  document.documentElement.classList.add('northbound-startup-lock');
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    splash.classList.add('is-leaving');
    document.documentElement.classList.remove('northbound-startup-lock');
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

  // The overlay is already in the HTML, so it is visible before any cloud work starts.
  void boot();
})();
