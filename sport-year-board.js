(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof customElements === 'undefined' || customElements.get('sport-year-board')) return;
  const labels = {running:'Laufen',trail_running:'Trailrunning',cycling:'Radfahren',swimming:'Schwimmen',triathlon:'Triathlon',hiking:'Wandern',football:'Fußball',handball:'Handball',basketball:'Basketball',volleyball:'Volleyball',tennis:'Tennis',padel:'Padel',badminton:'Badminton',strength_training:'Krafttraining',fitness:'Fitness',backyard:'Backyard',other:'Andere Sportart'};
  class SportYearBoard extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      this.items = [];
      this.innerHTML = '<section class="sy-board"><header><h2>Dein Sportjahr</h2><p class="sy-muted">In dieser Vorschau nur im Arbeitsspeicher – beim Neuladen werden die Einträge verworfen.</p></header><div class="sy-stats"><article><strong data-count>0</strong><span>Aktivitäten</span></article><article><strong data-km>0 km</strong><span>Gesamtdistanz</span></article><article><strong data-hm>0 hm</strong><span>Höhenmeter</span></article></div><div class="sy-filter"><label>Jahr<select data-year><option value="all">Alle Jahre</option></select></label><label>Sportart<select data-sport><option value="all">Alle Sportarten</option></select></label></div><div class="sy-list" aria-live="polite"></div></section>';
      this.querySelector('[data-year]').addEventListener('change', () => this.render());
      this.querySelector('[data-sport]').addEventListener('change', () => this.render());
      document.addEventListener('sport-year-activity', event => this.addActivity(event.detail));
      const style = document.createElement('style');
      style.textContent = '.sy-board{margin:24px 0;background:#0b1117;border:1px solid #273541;border-radius:16px;padding:20px;color:#f5f7fa}.sy-board h2{margin:0 0 5px}.sy-muted,.sy-group small{color:#aebbc6}.sy-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}.sy-stats article{padding:13px;background:#111c25;border:1px solid #273541;border-radius:10px}.sy-stats strong,.sy-stats span{display:block}.sy-stats strong{font-size:22px;color:#7fd8ff}.sy-stats span{font-size:12px;color:#aebbc6}.sy-filter{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.sy-filter label{display:grid;gap:5px;font-size:12px;color:#dce5eb}.sy-filter select{min-width:150px;padding:9px;background:#111c25;color:#f5f7fa;border:1px solid #40515e;border-radius:8px}.sy-group{margin:18px 0}.sy-group h3{font-size:15px;color:#ff6a00;border-bottom:1px solid #34434f;padding-bottom:7px}.sy-activity{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #24323d}.sy-activity strong{display:block}.sy-activity small{display:block;color:#aebbc6}.sy-empty{padding:18px;border:1px dashed #40515e;border-radius:10px;color:#aebbc6}@media(max-width:560px){.sy-board{padding:14px}.sy-stats{grid-template-columns:1fr 1fr}.sy-activity{display:block}}';
      document.head.appendChild(style);
      this.render();
    }
    addActivity(activity) {
      if (!activity || typeof activity !== 'object') return;
      this.items.push({...activity, id:'preview-' + (this.items.length + 1)});
      this.refreshFilters();
      this.render();
    }
    refreshFilters() {
      const years = [...new Set(this.items.map(x => x.startsAt ? String(new Date(x.startsAt).getFullYear()) : 'Ohne Datum'))].sort().reverse();
      const sports = [...new Set(this.items.map(x => x.sportCode || 'other'))].sort();
      const year = this.querySelector('[data-year]'), sport = this.querySelector('[data-sport]');
      const oldYear = year.value, oldSport = sport.value;
      year.replaceChildren(new Option('Alle Jahre','all'), ...years.map(x => new Option(x,x)));
      sport.replaceChildren(new Option('Alle Sportarten','all'), ...sports.map(x => new Option(labels[x] || x,x)));
      year.value = years.includes(oldYear) ? oldYear : 'all';
      sport.value = sports.includes(oldSport) ? oldSport : 'all';
    }
    render() {
      if (!this.querySelector('.sy-list')) return;
      const year = this.querySelector('[data-year]').value, sport = this.querySelector('[data-sport]').value;
      const selected = this.items.filter(x => {
        const y = x.startsAt ? String(new Date(x.startsAt).getFullYear()) : 'Ohne Datum';
        return (year === 'all' || y === year) && (sport === 'all' || x.sportCode === sport);
      }).sort((a,b) => String(b.startsAt || '').localeCompare(String(a.startsAt || '')));
      const km = selected.reduce((sum,x) => sum + (Number(x.distanceKm) || Number(x.result?.totalDistanceKm) || 0),0);
      const hm = selected.reduce((sum,x) => sum + (Number(x.elevationGainM) || 0),0);
      this.querySelector('[data-count]').textContent = String(selected.length);
      this.querySelector('[data-km]').textContent = km.toFixed(1) + ' km';
      this.querySelector('[data-hm]').textContent = Math.round(hm).toLocaleString('de-DE') + ' hm';
      const list = this.querySelector('.sy-list');
      list.replaceChildren();
      if (!selected.length) { const empty=document.createElement('p');empty.className='sy-empty';empty.textContent='Noch keine Aktivitäten erfasst. Fülle oben das Formular aus und übernimm den Eintrag.';list.appendChild(empty);return; }
      const groups = new Map();
      selected.forEach(item => { const key=labels[item.sportCode] || item.sportCode || 'Andere Sportart'; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item); });
      for (const [name,items] of groups) {
        const section=document.createElement('section');section.className='sy-group';
        const heading=document.createElement('h3');heading.textContent=name + ' · ' + items.length;section.appendChild(heading);
        for (const item of items) {
          const row=document.createElement('article');row.className='sy-activity';
          const left=document.createElement('div'), title=document.createElement('strong'), meta=document.createElement('small');
          title.textContent=item.title || 'Aktivität';
          const date=item.startsAt ? new Date(item.startsAt).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}) : 'Ohne Datum';
          const detail=[date,item.location, item.status==='completed'?'Absolviert':item.status==='cancelled'?'Abgesagt':'Geplant'].filter(Boolean);
          meta.textContent=detail.join(' · ');left.append(title,meta);
          const right=document.createElement('small');
          const distance=Number(item.distanceKm) || Number(item.result?.totalDistanceKm) || 0;
          right.textContent=[distance ? distance.toFixed(1)+' km' : '',item.elevationGainM ? Math.round(item.elevationGainM)+' hm' : '',item.result?.rounds!=null ? item.result.rounds+' Runden' : ''].filter(Boolean).join(' · ');
          row.append(left,right);section.appendChild(row);
        }
        list.appendChild(section);
      }
    }
  }
  customElements.define('sport-year-board',SportYearBoard);
})();