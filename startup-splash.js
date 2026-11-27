/* NORTHBOUND startup splash: logo-first reveal, full-screen iOS coverage and safe cloud handoff. */
(() => {
  'use strict';
  const splash = document.getElementById('northboundStartupSplash');
  if (!splash) return;

  document.documentElement.classList.add('northbound-startup-lock');

  // Keep the splash stretched between all viewport edges. Avoid a fixed 100dvh
  // height, which can leave the bottom of the iPhone visual viewport uncovered.
  splash.style.setProperty('position', 'fixed', 'important');
  splash.style.setProperty('inset', '0', 'important');
  splash.style.setProperty('height', 'auto', 'important');
  splash.style.setProperty('min-height', '100vh', 'important');
  splash.style.setProperty('width', 'auto', 'important');
  splash.style.setProperty('z-index', '2147483647', 'important');
  splash.classList.add('nb-splash-logo-first');

  // The first paint contains the NORTHBOUND mark only. Bring in the athletes
  // after the logo has appeared, rather than making the animation part of startup.
  const style = document.createElement('style');
  style.id = 'northbound-splash-art-direction';
  style.textContent = `
    #northboundStartupSplash.nb-splash-logo-first .nb-splash-athlete{
      opacity:0!important;visibility:hidden!important;transition:opacity .45s ease,visibility .45s ease!important
    }
    #northboundStartupSplash .nb-splash-athlete{
      filter:drop-shadow(0 10px 18px #020912aa)!important;
      animation-timing-function:linear!important
    }
    #northboundStartupSplash .nb-splash-athlete.runner{
      width:clamp(150px,36vw,220px)!important;animation-duration:8.5s!important
    }
    #northboundStartupSplash .nb-splash-athlete.cyclist{
      width:clamp(190px,44vw,280px)!important;animation-duration:10s!important
    }
    #northboundStartupSplash .nb-runner-motion{
      transform-origin:120px 92px;animation:nbRunnerStride .52s ease-in-out infinite alternate
    }
    #northboundStartupSplash .nb-cyclist-rider{
      transform-origin:175px 82px;animation:nbCyclistPedal .72s ease-in-out infinite alternate
    }
    #northboundStartupSplash:not(.nb-splash-logo-first) .nb-splash-athlete{
      opacity:1!important;visibility:visible!important
    }
    @keyframes nbRunnerStride{from{transform:translateY(2px) rotate(-1.8deg)}to{transform:translateY(-3px) rotate(1.8deg)}}
    @keyframes nbCyclistPedal{from{transform:translateY(0) rotate(-.6deg)}to{transform:translateY(-1.5px) rotate(.6deg)}}
    @media(prefers-reduced-motion:reduce){
      #northboundStartupSplash .nb-runner-motion,#northboundStartupSplash .nb-cyclist-rider{animation:none!important}
      #northboundStartupSplash .nb-splash-athlete{transition:none!important}
    }
  `;
  document.head.appendChild(style);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    splash.classList.add('is-leaving');
    document.documentElement.classList.remove('northbound-startup-lock');
    window.setTimeout(() => splash.remove(), 420);
  };

  // Reveal the motion only after the logo has had time to render.
  window.setTimeout(() => splash.classList.remove('nb-splash-logo-first'), 950);

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
