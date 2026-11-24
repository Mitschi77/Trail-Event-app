(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof customElements === 'undefined' || customElements.get('sport-year-board')) return;
  const labels = {running:'Laufen',trail_running:'Trailrunning',cycling:'Radfahren',swimming:'Schwimmen',triathlon:'Triathlon',hiking:'Wandern',football:'Fußball',handball:'Handball',basketball:'Basketball',volleyball:'Volleyball',tennis:'Tennis',padel:'Padel',badminton:'Badminton',strength_training:'Krafttraining',fitness:'Fitness',backyard:'Backyard',other:'Andere Sportart'};
  const durationLabel = seconds => {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 0) return '';
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60);
    return h ? h + ' h ' + m + ' min' : m ? m + ' min ' + s + ' s' : s + ' s';
  };
  class SportYearBoard extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      this.items = [];
      this.editingId = null;
      this.innerHTML = '<section class="sy-board"><header><h2>Dein Sportjahr</h2><p class="sy-muted">In dieser Vorschau nur im Arbeitsspeicher – beim Neuladen werden die Einträge verworfen.</p></header><div class="sy-stats"><article><strong data-count>0</strong><span>Aktivitäten</span></article><article><strong data-km>0 km</strong><span>Gesamtdistanz</span></article><article><strong data-hm>0 hm</strong><span>Höhenmeter</span></article><article><strong data-duration>0 h</strong><span>Trainingszeit</span></article></div><div class="sy-filter"><label>Jahr<select data-year><option value="all">Alle Jahre</option></select></label><label>Sportart<select data-sport><option value="all">Alle Sportarten</option></select></label></div><section class="sy-chart" data-chart aria-label="Jahresvergleich"></section><section class="sy-months" data-months aria-label="Monatsübersicht"></section><div class="sy-list" aria-live="polite"></div></section>';
      this.querySelector('[data-year]').addEventListener('change', () => this.render());
      this.querySelector('[data-sport]').addEventListener('change', () => this.render());
      this.querySelector('.sy-list').addEventListener('click', event => this.handleAction(event));
      this.querySelector('.sy-list').addEventListener('submit', event => this.saveEdit(event));
      document.addEventListener('sport-year-activity', event => this.addActivity(event.detail));
      const style = document.createElement('style');
      style.textContent = '.sy-board{margin:24px 0;background:#0b1117;border:1px solid #273541;border-radius:16px;padding:20px;color:#f5f7fa}.sy-board h2{margin:0 0 5px}.sy-muted,.sy-group small{color:#aebbc6}.sy-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.sy-stats article{padding:13px;background:#111c25;border:1px solid #273541;border-radius:10px}.sy-stats strong,.sy-stats span{display:block}.sy-stats strong{font-size:22px;color:#7fd8ff}.sy-stats span{font-size:12px;color:#aebbc6}.sy-filter{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.sy-filter label{display:grid;gap:5px;font-size:12px;color:#dce5eb}.sy-filter select{min-width:150px;padding:9px;background:#111c25;color:#f5f7fa;border:1px solid #40515e;border-radius:8px}.sy-chart{display:grid;gap:10px;margin:16px 0}.sy-chart-row{padding:12px;background:#111c25;border:1px solid #34434f;border-radius:10px}.sy-chart-row h3{margin:0 0 10px;color:#f5f7fa;font-size:13px}.sy-bars{display:flex;gap:8px;align-items:end;min-height:92px;overflow-x:auto;padding:0 2px 6px;scrollbar-color:#40515e #111c25}.sy-bar-cell{display:flex;flex:0 0 48px;flex-direction:column;justify-content:end;align-items:center;gap:4px;min-width:48px;height:92px}.sy-bar{width:100%;max-width:24px;min-height:2px;background:#ff6a00;border-radius:4px 4px 0 0}.sy-bar-label{font-size:9px;color:#aebbc6;white-space:nowrap}.sy-bar-value{font-size:9px;color:#7fd8ff;white-space:nowrap}.sy-month-activities{margin:8px 0 0;padding:0;list-style:none}.sy-month-activities li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #24323d;color:#dce5eb;font-size:11px}.sy-month-activities li span:last-child{color:#7fd8ff;white-space:nowrap}.sy-months{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:16px 0}.sy-month{padding:12px;background:#111c25;border:1px solid #34434f;border-radius:10px}.sy-month h3{margin:0 0 6px;color:#ff6a00;font-size:14px}.sy-month p{margin:3px 0;color:#c5d0d8;font-size:12px}.sy-month strong{color:#7fd8ff}.sy-month-sports{margin-top:7px;padding-top:7px;border-top:1px solid #34434f;color:#aebbc6;font-size:11px}.sy-group{margin:18px 0}.sy-group h3{font-size:15px;color:#ff6a00;border-bottom:1px solid #34434f;padding-bottom:7px}.sy-group h3 small{display:block;color:#aebbc6;font-size:11px;font-weight:400;margin-top:4px}.sy-activity{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #24323d}.sy-activity strong{display:block}.sy-activity small{display:block;color:#aebbc6}.sy-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.sy-actions button,.sy-edit button{padding:7px 10px;border:1px solid #40515e;border-radius:7px;background:#17232d;color:#f5f7fa;cursor:pointer}.sy-actions button[data-remove]{border-color:#9b4a36;color:#ffb19b}.sy-edit{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0;padding:10px;background:#111c25;border:1px solid #40515e;border-radius:8px}.sy-edit label{display:grid;gap:4px;font-size:12px;color:#aebbc6}.sy-edit input{min-width:0;width:100%;box-sizing:border-box;padding:8px;background:#0b1117;color:#f5f7fa;border:1px solid #40515e;border-radius:6px}.sy-edit .sy-edit-actions{display:flex;gap:7px;align-items:end}.sy-detail{margin-top:9px}.sy-detail summary{color:#7fd8ff;cursor:pointer;font-size:13px}.sy-detail-content{margin-top:8px;padding:10px;background:#111c25;border:1px solid #273541;border-radius:8px;color:#dce5eb;font-size:13px}.sy-detail-content p{margin:4px 0}.sy-segment{padding:7px 0;border-top:1px solid #34434f}.sy-empty{padding:18px;border:1px dashed #40515e;border-radius:10px;color:#aebbc6}@media(max-width:560px){.sy-board{padding:14px}.sy-months{grid-template-columns:1fr}.sy-stats{grid-template-columns:1fr 1fr}.sy-activity{display:block}}';
      document.head.appendChild(style);
      this.render();
    }
    addActivity(activity) {
      if (!activity || typeof activity !== 'object') return;
      this.items.push({...activity, id:'preview-' + (this.items.length + 1)});
      this.refreshFilters();
      this.render();
    }
    handleAction(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === 'remove') {
        this.items = this.items.filter(item => item.id !== id);
        if (this.editingId === id) this.editingId = null;
        this.refreshFilters();
        this.render();
      } else if (button.dataset.action === 'edit') {
        this.editingId = id;
        this.render();
      } else if (button.dataset.action === 'cancel') {
        this.editingId = null;
        this.render();
      }
    }
    saveEdit(event) {
      const form = event.target.closest('form[data-edit-form]');
      if (!form) return;
      event.preventDefault();
      const item = this.items.find(entry => entry.id === form.dataset.id);
      if (!item) return;
      const data = new FormData(form);
      const parseNonNegative = name => {
        const raw = String(data.get(name) ?? '').trim();
        if (raw === '') return 0;
        const value = Number(raw);
        return Number.isFinite(value) && value >= 0 ? value : null;
      };
      const distanceKm = parseNonNegative('distanceKm');
      const elevationGainM = parseNonNegative('elevationGainM');
      let error = form.querySelector('[data-edit-error]');
      if (!error) {
        error = document.createElement('p');
        error.dataset.editError = 'true';
        error.setAttribute('role','alert');
        error.style.color = '#ffb19b';
        form.appendChild(error);
      }
      if (distanceKm === null || elevationGainM === null) {
        error.textContent = 'Bitte gib für Distanz und Höhenmeter jeweils eine Zahl ab 0 ein.';
        return;
      }
      item.title = String(data.get('title') || '').trim() || 'Aktivität';
      item.distanceKm = distanceKm;
      item.elevationGainM = elevationGainM;
      if (Array.isArray(item.segments) && item.segments.length) {
        item.segments = item.segments.map((segment, index) => {
          const next = { ...segment };
          if (segment.distance != null) {
            const value = parseNonNegative('segmentDistance_' + index);
            if (value === null) throw new Error('Segmentdistanz muss eine Zahl ab 0 sein.');
            next.distance = value;
          }
          if (segment.durationSeconds != null) {
            const value = parseNonNegative('segmentDuration_' + index);
            if (value === null) throw new Error('Segmentzeit muss eine Zahl ab 0 sein.');
            next.durationSeconds = value;
          }
          return next;
        });
        const segmentDistances = item.segments.filter(segment => segment.distance != null)
          .reduce((sum, segment) => sum + Number(segment.distance), 0);
        if (item.segments.some(segment => segment.distance != null)) {
          item.distanceKm = Number(segmentDistances.toFixed(3));
        }
      }
      this.editingId = null;
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
      const duration = selected.reduce((sum,x) => sum + (Number(x.durationSeconds) || 0),0);
      this.querySelector('[data-count]').textContent = String(selected.length);
      this.querySelector('[data-km]').textContent = km.toFixed(1) + ' km';
      this.querySelector('[data-hm]').textContent = Math.round(hm).toLocaleString('de-DE') + ' hm';
      this.querySelector('[data-duration]').textContent = durationLabel(duration) || '0 min';
      const chart = this.querySelector('[data-chart]');
      chart.replaceChildren();
      const chartMonths = new Map();
      selected.forEach(item => {
        const date=item.startsAt ? new Date(item.startsAt) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
        if(!chartMonths.has(key)) chartMonths.set(key,{km:0,hm:0,seconds:0});
        const values=chartMonths.get(key);
        values.km+=Number(item.distanceKm)||Number(item.result?.totalDistanceKm)||0;
        values.hm+=Number(item.elevationGainM)||0;
        values.seconds+=Number(item.durationSeconds)||0;
      });
      const chartData=[...chartMonths].sort(([a],[b])=>a.localeCompare(b));
      if(!chartData.length){
        const empty=document.createElement('p');empty.className='sy-empty';
        empty.textContent='Für diese Auswahl liegen noch keine datierten Aktivitäten vor.';
        chart.appendChild(empty);
      } else {
      for(const [metric,label,format] of [
        ['km','Distanz pro Monat',value=>value.toFixed(1)+' km'],
        ['hm','Höhenmeter pro Monat',value=>Math.round(value).toLocaleString('de-DE')+' hm'],
        ['seconds','Trainingszeit pro Monat',value=>durationLabel(value)||'0 min']
      ]) {
        const section=document.createElement('section');section.className='sy-chart-row';
        const heading=document.createElement('h3');heading.textContent=label;
        const bars=document.createElement('div');bars.className='sy-bars';
        const max=Math.max(0,...chartData.map(([,values])=>values[metric]));
        for(const [key,values] of chartData) {
          const cell=document.createElement('div');cell.className='sy-bar-cell';cell.setAttribute('aria-label',key+': '+label+' '+format(values[metric]));
          const value=document.createElement('span');value.className='sy-bar-value';value.textContent=format(values[metric]);
          const bar=document.createElement('div');bar.className='sy-bar';bar.style.height=(max>0?Math.max(2,values[metric]/max*58):2)+'px';bar.title=label+': '+format(values[metric]);
          const month=document.createElement('span');month.className='sy-bar-label';month.textContent=key.slice(5,7)+'/'+key.slice(2,4);
          cell.append(value,bar,month);bars.appendChild(cell);
        }
        section.append(heading,bars);chart.appendChild(section);
      }
      }
      const months = this.querySelector('[data-months]');
      months.replaceChildren();
      const monthGroups = new Map();
      selected.forEach(item => {
        const date = item.startsAt ? new Date(item.startsAt) : null;
        const key = date && !Number.isNaN(date.getTime()) ? date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0') : 'undated';
        if (!monthGroups.has(key)) monthGroups.set(key, []);
        monthGroups.get(key).push(item);
      });
      for (const [key, items] of monthGroups) {
        const month = document.createElement('article'); month.className='sy-month';
        const heading = document.createElement('h3');
        heading.textContent = key === 'undated' ? 'Ohne Datum' : new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
        const monthKm=items.reduce((sum,x)=>sum+(Number(x.distanceKm)||Number(x.result?.totalDistanceKm)||0),0);
        const monthHm=items.reduce((sum,x)=>sum+(Number(x.elevationGainM)||0),0);
        const monthDuration=items.reduce((sum,x)=>sum+(Number(x.durationSeconds)||0),0);
        const metrics=document.createElement('p'); metrics.textContent=items.length+' Aktivitäten · '+monthKm.toFixed(1)+' km · '+Math.round(monthHm).toLocaleString('de-DE')+' hm';
        const time=document.createElement('p'); time.textContent='Trainingszeit: '+(durationLabel(monthDuration)||'0 min');
        const sportCounts=new Map(); items.forEach(x=>{const name=labels[x.sportCode]||x.sportCode||'Andere Sportart';sportCounts.set(name,(sportCounts.get(name)||0)+1);});
        const sports=document.createElement('div'); sports.className='sy-month-sports'; sports.textContent=[...sportCounts].map(([name,count])=>name+' '+count).join(' · ');
        const activityList=document.createElement('ul'); activityList.className='sy-month-activities';
        for (const item of items) {
          const line=document.createElement('li');
          const name=document.createElement('span'); name.textContent=item.title || 'Aktivität';
          const value=document.createElement('span'); const distance=Number(item.distanceKm)||Number(item.result?.totalDistanceKm)||0; value.textContent=distance ? distance.toFixed(1)+' km' : (item.durationSeconds!=null ? durationLabel(item.durationSeconds) : '');
          line.append(name,value); activityList.appendChild(line);
        }
        month.append(heading,metrics,time,sports,activityList); months.appendChild(month);
      }
      const list = this.querySelector('.sy-list');
      list.replaceChildren();
      if (!selected.length) { const empty=document.createElement('p');empty.className='sy-empty';empty.textContent='Noch keine Aktivitäten erfasst. Fülle oben das Formular aus und übernimm den Eintrag.';list.appendChild(empty);return; }
      const groups = new Map();
      selected.forEach(item => { const key=labels[item.sportCode] || item.sportCode || 'Andere Sportart'; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item); });
      for (const [name,items] of groups) {
        const section=document.createElement('section');section.className='sy-group';
        const heading=document.createElement('h3');heading.textContent=name + ' · ' + items.length;
        const groupKm=items.reduce((sum,x)=>sum+(Number(x.distanceKm)||Number(x.result?.totalDistanceKm)||0),0);
        const groupHm=items.reduce((sum,x)=>sum+(Number(x.elevationGainM)||0),0);
        const groupDuration=items.reduce((sum,x)=>sum+(Number(x.durationSeconds)||0),0);
        const groupMeta=document.createElement('small');groupMeta.textContent=groupKm.toFixed(1)+' km · '+Math.round(groupHm).toLocaleString('de-DE')+' hm · '+(durationLabel(groupDuration)||'0 min');heading.appendChild(groupMeta);section.appendChild(heading);
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
          row.append(left,right);
          const actions=document.createElement('div');actions.className='sy-actions';
          for(const [action,label] of [['edit','Bearbeiten'],['remove','Entfernen']]){
            const button=document.createElement('button');button.type='button';button.dataset.action=action;button.dataset.id=item.id;button.textContent=label;
            if(action==='remove')button.dataset.remove='true';
            actions.appendChild(button);
          }
          const entry=document.createElement('div');entry.append(row,actions);
          if(this.editingId===item.id){
            const form=document.createElement('form');form.className='sy-edit';form.dataset.editForm='true';form.dataset.id=item.id;
            const fields=[['title','Name',item.title||''],['distanceKm','Distanz (km)',item.distanceKm||item.result?.totalDistanceKm||''],['elevationGainM','Höhenmeter',item.elevationGainM||'']];
            for(const [name,label,value] of fields){
              const field=document.createElement('label');field.textContent=label;
              const input=document.createElement('input');input.name=name;input.value=String(value);input.type=name==='title'?'text':'number';if(name!=='title'){input.min='0';input.step='any';input.inputMode='decimal';input.required=false;}
              field.appendChild(input);form.appendChild(field);
            }
            if (Array.isArray(item.segments)) {
              item.segments.forEach((segment, index) => {
                if (segment.distance != null) {
                  const field=document.createElement('label');field.textContent=(segment.name || segment.segmentType || 'Segment')+' · Distanz (km)';
                  const input=document.createElement('input');input.name='segmentDistance_'+index;input.type='number';input.min='0';input.step='any';input.value=String(segment.distance);
                  field.appendChild(input);form.appendChild(field);
                }
                if (segment.durationSeconds != null) {
                  const field=document.createElement('label');field.textContent=(segment.segmentType==='transition_1'?'Wechselzeit T1':segment.segmentType==='transition_2'?'Wechselzeit T2':(segment.name || segment.segmentType || 'Segment'))+' · Zeit (Sekunden)';
                  const input=document.createElement('input');input.name='segmentDuration_'+index;input.type='number';input.min='0';input.step='1';input.value=String(segment.durationSeconds);
                  field.appendChild(input);form.appendChild(field);
                }
              });
            }
            const controls=document.createElement('div');controls.className='sy-edit-actions';
            const save=document.createElement('button');save.type='submit';save.textContent='Speichern';
            const cancel=document.createElement('button');cancel.type='button';cancel.dataset.action='cancel';cancel.dataset.id=item.id;cancel.textContent='Abbrechen';
            controls.append(save,cancel);form.appendChild(controls);entry.appendChild(form);
          }

          const detailBox=document.createElement('details');detailBox.className='sy-detail';
          const summary=document.createElement('summary');summary.textContent='Aktivitätsdetails';detailBox.appendChild(summary);
          const body=document.createElement('div');body.className='sy-detail-content';
          const facts=[
            item.durationSeconds!=null ? 'Dauer: '+durationLabel(item.durationSeconds) : '',
            item.result?.format ? 'Ergebnisformat: '+item.result.format : '',
            item.result?.outcome ? 'Ergebnis: '+item.result.outcome : '',
            item.result?.rounds!=null ? 'Rundenlänge: '+Number(item.result.lapLengthKm || 6.7).toFixed(2)+' km' : '',
            item.result?.eliminatedAfterRound!=null ? 'Ausgeschieden nach Runde: '+item.result.eliminatedAfterRound : '',
            item.result?.opponent ? 'Gegner: '+item.result.opponent : '',
            item.result?.team ? 'Mannschaft: '+item.result.team : '',
            item.result?.scoreFor!=null ? 'Spielstand: '+item.result.scoreFor+':'+item.result.scoreAgainst : ''
          ].filter(Boolean);
          for(const fact of facts){const p=document.createElement('p');p.textContent=fact;body.appendChild(p);}
          if(Array.isArray(item.segments)&&item.segments.length){
            const label=document.createElement('p');label.textContent='Mehrkampf-/Aktivitätssegmente';body.appendChild(label);
            for(const segment of item.segments){
              const line=document.createElement('div');line.className='sy-segment';
              const segmentName=segment.name || (segment.segmentType==='transition_1'?'Wechselzeit T1':segment.segmentType==='transition_2'?'Wechselzeit T2':labels[segment.sportCode] || segment.segmentType || 'Segment');
              const segmentFacts=[segment.distance!=null?Number(segment.distance).toFixed(1)+' '+(segment.distanceUnit||'km'):'',segment.durationSeconds!=null?durationLabel(segment.durationSeconds):''].filter(Boolean);
              line.textContent=segment.sequence+'. '+segmentName+(segmentFacts.length?' · '+segmentFacts.join(' · '):'');
              body.appendChild(line);
            }
          }
          if(!facts.length && !(Array.isArray(item.segments)&&item.segments.length)){const p=document.createElement('p');p.textContent='Keine zusätzlichen Details erfasst.';body.appendChild(p);}
          detailBox.appendChild(body);entry.appendChild(detailBox);section.appendChild(entry);
        }
        list.appendChild(section);
      }
    }
  }
  customElements.define('sport-year-board',SportYearBoard);
})();