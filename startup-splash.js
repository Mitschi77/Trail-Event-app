/* NORTHBOUND startup splash: premium filled athlete artwork and safe cloud handoff. */
(() => {
  'use strict';
  const splash = document.getElementById('northboundStartupSplash');
  if (!splash) return;

  document.documentElement.classList.add('northbound-startup-lock');

  // Replace the placeholder line-art drawings with filled, layered athlete silhouettes.
  const runner = splash.querySelector('.nb-splash-athlete.runner');
  if (runner) {
    runner.setAttribute('viewBox', '0 0 240 180');
    runner.innerHTML = `
      <defs>
        <linearGradient id="nbRunnerKit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb15c"/><stop offset=".52" stop-color="#ff7a24"/><stop offset="1" stop-color="#d94e20"/></linearGradient>
        <linearGradient id="nbRunnerLeg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eaf4fa"/><stop offset="1" stop-color="#91b7ce"/></linearGradient>
      </defs>
      <g class="nb-runner-motion">
        <path d="M104 50c-11 7-20 19-26 34l29 18 34-21-9-24c-7-8-17-11-28-7Z" fill="url(#nbRunnerKit)"/>
        <path d="M110 49c-10-8-17-20-14-31 3-12 15-17 25-10 10 7 9 22 2 31-3 5-8 8-13 10Z" fill="#e7eef2"/>
        <path d="m98 60-26 8-22 26c-4 5-12 3-13-3-1-3 0-6 2-9l24-31 29-17Z" fill="#e7eef2"/>
        <path d="m132 62 24 12 20 24c4 5 1 12-5 12-3 0-5-1-7-4l-25-17-18-7Z" fill="#dce8ef"/>
        <path d="m104 98-24 27-33 14c-8 4-7 15 2 17l9-1 39-14 32-27Z" fill="url(#nbRunnerLeg)"/>
        <path d="m132 96 23 24 32 10c9 3 10 14 1 18l-8 1-42-13-30-21Z" fill="#eaf3f8"/>
        <path d="m51 137-19 14-17 1c-8 0-11 9-4 13l26 2 22-12Z" fill="#ff842b"/>
        <path d="m185 130 20 4 15 12c6 5 3 13-5 13l-27-9-16-9Z" fill="#ff842b"/>
        <path d="M105 53c10 9 21 13 34 10l-3 16c-13 7-27 5-40-3Z" fill="#fff" opacity=".22"/>
      </g>
      <path d="M5 168q42-17 80-7t75-2 75 3" fill="none" stroke="#ff8a35" stroke-width="2" opacity=".45"/>
    `;
  }

  const cyclist = splash.querySelector('.nb-splash-athlete.cyclist');
  if (cyclist) {
    cyclist.setAttribute('viewBox', '0 0 340 190');
    cyclist.innerHTML = `
      <defs>
        <linearGradient id="nbCycleFrame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a36af2"/><stop offset=".52" stop-color="#48b8df"/><stop offset="1" stop-color="#ff8a35"/></linearGradient>
        <linearGradient id="nbCycleKit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb15c"/><stop offset="1" stop-color="#ed6327"/></linearGradient>
      </defs>
      <g fill="none" stroke="#d9e7ef" stroke-width="3.5">
        <circle class="nb-splash-wheel" cx="70" cy="139" r="43"/><circle class="nb-splash-wheel" cx="270" cy="139" r="43"/>
        <circle cx="70" cy="139" r="3" fill="#ff8a35"/><circle cx="270" cy="139" r="3" fill="#ff8a35"/>
      </g>
      <g fill="none" stroke="url(#nbCycleFrame)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M70 139 126 69 176 139H70l79 0 61-72 60 72M126 69l-24-8m159 8 16-9 12 1"/>
      </g>
      <path d="M216 67h25l11 8-4 8h-22" fill="none" stroke="#e5eef4" stroke-width="6" stroke-linecap="round"/>
      <g class="nb-cyclist-rider">
        <path d="M147 42c-8-11-4-24 7-29 12-5 23 4 21 16-1 8-8 14-17 15Z" fill="#e8f1f5"/>
        <path d="M146 48c15-9 34-7 48 2l26 18-22 16-35-13-29 17-24-13 18-22Z" fill="url(#nbCycleKit)"/>
        <path d="m178 49 34 12 25 6 13 13-10 6-31-10-31-8Z" fill="#e5eef3"/>
        <path d="m151 75-24 27-24 28c-5 6-1 14 7 14 3 0 6-2 8-4l36-31 28-22Z" fill="#d9e7ee"/>
        <path d="m180 78 27 24 23 19c6 5 14 1 14-7 0-3-2-6-5-8l-34-30-20-15Z" fill="#e8f1f5"/>
        <path d="m102 130-12 8-13-2-5 7 25 5 17-10Z" fill="#ff842b"/>
        <path d="m229 119 14 7 11-2 6 7-23 6-17-9Z" fill="#ff842b"/>
      </g>
      <path d="M22 183q70-18 142-8t150-1" fill="none" stroke="#ff8a35" stroke-width="2" opacity=".42"/>
    `;
  }

  const style = document.createElement('style');
  style.id = 'northbound-splash-art-direction';
  style.textContent = `
    .nb-splash-athlete{filter:drop-shadow(0 10px 18px #020912aa)!important;animation-timing-function:linear!important}
    .nb-splash-athlete.runner{width:clamp(150px,36vw,220px)!important;animation-duration:8.5s!important}
    .nb-splash-athlete.cyclist{width:clamp(190px,44vw,280px)!important;animation-duration:10s!important}
    .nb-runner-motion{transform-origin:120px 92px;animation:nbRunnerStride .52s ease-in-out infinite alternate}
    .nb-cyclist-rider{transform-origin:175px 82px;animation:nbCyclistPedal .72s ease-in-out infinite alternate}
    @keyframes nbRunnerStride{from{transform:translateY(2px) rotate(-1.8deg)}to{transform:translateY(-3px) rotate(1.8deg)}}
    @keyframes nbCyclistPedal{from{transform:translateY(0) rotate(-.6deg)}to{transform:translateY(-1.5px) rotate(.6deg)}}
    @media(prefers-reduced-motion:reduce){.nb-runner-motion,.nb-cyclist-rider{animation:none!important}}
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
