/* Alpine Performance: clear planning-only disclaimer for organizer GPX files. */
(()=>{
  const NOTICE='Die hier veröffentlichte GPX-Datei dient ausschließlich der Planung. Für Richtigkeit und Aktualität wird keine Gewähr übernommen. Bitte verwende vor Eventbeginn immer die aktuellste GPX-Datei des Veranstalters.';
  const addNotice=root=>{
    const blocks=[];
    if(root.matches?.('.gpx-import'))blocks.push(root);
    root.querySelectorAll?.('.gpx-import').forEach(el=>blocks.push(el));
    blocks.forEach(block=>{
      if(block.querySelector(':scope > .gpx-planning-notice'))return;
      const note=document.createElement('p');
      note.className='note gpx-planning-notice';
      note.textContent=NOTICE;
      block.append(note);
    });
  };
  const start=()=>{addNotice(document);new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE)addNotice(node);}))).observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

/* Show saved per-route accommodation dates in the annual calendar as blue hotel days. */
(()=>{
  const originalCalendar=window.renderYearCalendar;
  if(typeof originalCalendar!=='function')return;
  const datePattern=/^\d{4}-\d{2}-\d{2}$/;
  const renderTravelDays=()=>{
    const root=document.getElementById('yearCalendar');
    if(!root)return;
    const ranges=[];
    const seen=new Set();
    const addRoute=(id,ri)=>{
      const event=EVENTS?.[id],route=event?.routes?.[ri];
      if(!event||!route||typeof eventDataEdits!=='object'||typeof routeKey!=='function')return;
      const plan=eventDataEdits[routeKey(id,ri)]?.travelPlan;
      if(!plan)return;
      const arrival=String(plan.arrival||'').trim(),departure=String(plan.departure||arrival).trim();
      if(!datePattern.test(arrival)||!datePattern.test(departure)||departure<arrival)return;
      const key=[event.id,route.id,arrival,departure].join('::');
      if(seen.has(key))return;
      seen.add(key);
      ranges.push({arrival,departure,title:(plan.accommodation||'Unterkunft')+' · '+event.name+' · '+(route.route||'Strecke')});
    };
    try{
      plannedEventIds.forEach((id,index)=>{
        const ri=Number.isInteger(plannedRouteIndices[id])?plannedRouteIndices[id]:(index===0?plannedBaseRouteIndex:0);
        addRoute(id,ri);
      });
      (plannedRepeatEntries||[]).forEach(entry=>addRoute(entry.id,entry.ri));
    }catch(error){console.warn('Reisezeiträume konnten nicht in den Kalender übernommen werden.',error);return;}
    if(!ranges.length)return;
    const monthNames=Array.from({length:12},(_,month)=>new Intl.DateTimeFormat('de-DE',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,month,1))));
    root.querySelectorAll('.year-calendar-year').forEach(yearSection=>{
      const year=Number(yearSection.querySelector(':scope > h3')?.textContent.trim());
      if(!Number.isInteger(year))return;
      yearSection.querySelectorAll('.year-calendar-month').forEach((monthSection,month)=>{
        const days=monthSection.querySelector('.year-calendar-days');
        if(!days||monthNames[month]!==monthSection.querySelector('h4')?.textContent.trim())return;
        days.querySelectorAll('.year-calendar-day:not(.empty)').forEach(cell=>{
          const day=Number(cell.querySelector('.day-number')?.textContent);
          if(!Number.isInteger(day))return;
          const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
          const matches=ranges.filter(range=>key>=range.arrival&&key<=range.departure);
          if(!matches.length)return;
          cell.classList.add('has-hotel');
          cell.dataset.calendarDate=key;
          cell.classList.remove('hotel-range-start','hotel-range-end');
          const oldTitle=cell.getAttribute('title')||'';
          cell.setAttribute('title',[oldTitle,...matches.map(x=>'Unterkunft: '+x.title)].filter(Boolean).join(' | '));
          let stack=cell.querySelector('.hotel-mark');
          if(!stack){
            stack=document.createElement('span');
            stack.className='day-mark hotel-mark hotel-range-stack';
            cell.append(stack);
          }
          stack.replaceChildren();
          stack.setAttribute('aria-hidden','true');
          matches.forEach(range=>{
            const segment=document.createElement('span');
            segment.className='hotel-range-bar';
            if(key===range.arrival)segment.classList.add('start');
            if(key===range.departure)segment.classList.add('end');
            stack.append(segment);
          });
        });
      });
    });
  };
  window.renderYearCalendar=function(){
    originalCalendar();
    renderTravelDays();
  };
})();


/* NORTHBOUND: Regenerationsplanung und Event-Datenqualität */
(()=>{'use strict';
const RECOVERY_ID='northboundRecoveryPlanner',QUALITY_ID='northboundEventQuality',RECOVERY_KEY='__northboundRecoveryPlanner';
const arr=x=>Array.isArray(x)?x:[];
const dateOf=x=>{if(!x)return null;const d=new Date(String(x).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?null:d;};
const dateLabel=d=>d?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(d):'Termin offen';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const settings=()=>({days:Math.max(7,Math.min(56,Number(typeof seasonPriorities!=='undefined'?seasonPriorities?.[RECOVERY_KEY]?.days:0)||14))});
function lastRace(){
 if(typeof runAttempts==='undefined'||typeof EVENTS==='undefined'||typeof routeKey!=='function')return null;
 const routes=new Map();
 EVENTS.forEach((e,ei)=>arr(e?.routes).forEach((r,ri)=>{try{routes.set(routeKey(ei,ri),{e,r});}catch(_){}}));
 let latest=null;
 Object.entries(runAttempts||{}).forEach(([key,list])=>arr(list).forEach(a=>{
  if(!a?.done||!a.date)return;const date=dateOf(a.date);if(!date)return;
  if(!latest||date>latest.date){const match=routes.get(key);latest={date,a,e:match?.e,r:match?.r};}
 }));
 return latest;
}
function suggestions(after){
 if(typeof EVENTS==='undefined')return [];
 const rows=[];EVENTS.forEach(e=>arr(e?.routes).forEach(r=>{
  const date=dateOf(r?.date||e?.date);if(date&&date>=after)rows.push({e,r,date});
 }));
 return rows.sort((a,b)=>a.date-b.date).slice(0,5);
}
function recoveryPanel(){
 const root=document.getElementById('seasonTimeline');if(!root)return;
 let panel=root.querySelector('#'+RECOVERY_ID);if(!panel){panel=document.createElement('section');panel.id=RECOVERY_ID;panel.className='nb-insight-panel';root.append(panel);}
 panel.replaceChildren();const cfg=settings(),last=lastRace();
 const header=document.createElement('div');header.className='nb-insight-head';
 const intro=document.createElement('div');intro.innerHTML='<span class="nb-eyebrow">NORTHBOUND · PLANUNG</span><h3>Regenerationsfenster</h3><p>Ein manuell einstellbarer Planungspuffer nach deinem letzten gespeicherten Wettkampf.</p>';
 const form=document.createElement('div');form.className='nb-recovery-setting';const label=document.createElement('label');label.textContent='Planungspuffer (Tage)';
 const input=document.createElement('input');input.type='number';input.min='7';input.max='56';input.value=cfg.days;input.setAttribute('aria-label','Planungspuffer in Tagen');
 const save=document.createElement('button');save.type='button';save.className='secondary';save.textContent='Speichern';label.append(input);form.append(label,save);header.append(intro,form);panel.append(header);
 const status=document.createElement('p');status.className='nb-insight-status';status.setAttribute('aria-live','polite');panel.append(status);
 save.addEventListener('click',()=>{
  const days=Number(input.value);if(!Number.isInteger(days)||days<7||days>56){status.textContent='Bitte 7 bis 56 Tage eingeben.';return;}
  if(typeof seasonPriorities==='undefined'||!seasonPriorities){status.textContent='Saisonplanung nicht verfügbar.';return;}
  seasonPriorities[RECOVERY_KEY]={days};try{if(typeof seasonSave==='function')seasonSave();else localStorage.setItem('seasonPriorities',JSON.stringify(seasonPriorities));recoveryPanel();const refreshed=document.querySelector('#'+RECOVERY_ID+' .nb-insight-status');if(refreshed)refreshed.textContent='Planungspuffer gespeichert.';}catch(e){status.textContent='Speichern fehlgeschlagen: '+e.message;}
 });
 if(!last){const empty=document.createElement('p');empty.className='nb-insight-empty';empty.textContent='Noch kein abgeschlossener Wettkampf mit Datum in der Laufhistorie gefunden.';panel.append(empty);return;}
 const end=new Date(last.date);end.setDate(end.getDate()+cfg.days);const today=new Date();today.setHours(12,0,0,0);
 const eventName=last.e?.name||'Letzter gespeicherter Wettkampf',routeName=last.r?.route||last.r?.name||'';
 const metrics=[last.a.actualKm?Number(last.a.actualKm).toFixed(1)+' km':'',last.a.actualHm?Math.round(Number(last.a.actualHm))+' hm':''].filter(Boolean).join(' · ');
 const info=document.createElement('div');info.className='nb-recovery-last';const strong=document.createElement('strong');strong.textContent=eventName+(routeName?' · '+routeName:'');const small=document.createElement('span');small.textContent='Gelaufen: '+dateLabel(last.date)+(metrics?' · '+metrics:'');info.append(strong,small);panel.append(info);
 const phases=document.createElement('div');phases.className='nb-recovery-timeline';
 [{label:'Direkt danach',days:Math.max(1,Math.round(cfg.days*.25)),cls:'one'},{label:'Ruhiger Aufbau',days:Math.max(1,Math.round(cfg.days*.35)),cls:'two'},{label:'Übergang',days:Math.max(1,cfg.days-Math.round(cfg.days*.25)-Math.round(cfg.days*.35)),cls:'three'}].forEach(p=>{const block=document.createElement('div');block.className='nb-recovery-phase '+p.cls;block.style.flexGrow=p.days;const b=document.createElement('b');b.textContent=p.label;const s=document.createElement('small');s.textContent=p.days+' Tage';block.append(b,s);phases.append(block);});
 panel.append(phases);
 const elapsed=Math.max(0,Math.min(cfg.days,Math.floor((today-last.date)/86400000)));const progress=document.createElement('p');progress.className='nb-insight-status';progress.textContent=elapsed>=cfg.days?'Eingestellter Planungspuffer abgelaufen.':elapsed+' von '+cfg.days+' Tagen · Ende: '+dateLabel(end)+'.';panel.append(progress);
 const h=document.createElement('h4');h.textContent='Nächste Termine nach dem Planungspuffer';panel.append(h);
 const next=suggestions(end);if(!next.length){const empty=document.createElement('p');empty.className='nb-insight-empty';empty.textContent='Keine datierten Strecken nach diesem Planungspuffer gefunden.';panel.append(empty);}
 else{const list=document.createElement('div');list.className='nb-recovery-suggestions';next.forEach(x=>{const row=document.createElement('article');row.className='nb-recovery-suggestion';const b=document.createElement('b');b.textContent=x.e.name||'Event';const s=document.createElement('span');s.textContent=(x.r.route||x.r.name||'Strecke')+' · '+dateLabel(x.date)+' · '+[x.r.km?Number(x.r.km).toFixed(1)+' km':'',x.r.hm?Math.round(x.r.hm)+' hm':''].filter(Boolean).join(' · ');row.append(b,s);list.append(row);});panel.append(list);}
 const note=document.createElement('p');note.className='nb-insight-footnote';note.textContent='Planungshilfe, keine medizinische oder trainingswissenschaftliche Freigabe. Der Zeitraum bewertet nicht deine individuelle Belastbarkeit.';panel.append(note);
}
function quality(event,record){
 const routes=arr(event?.routes),n=routes.length,feedRoutes=Object.values(record?.routes||{}),sources=arr(record?.sources);
 const datePresent=Boolean(event?.date||routes.some(r=>r?.date)||record?.eventPeriod?.startDate||feedRoutes.some(r=>r?.date));
 const dateVerified=Boolean(record?.eventPeriod?.verified||feedRoutes.some(r=>r?.verified));
 const km=n>0&&routes.every(r=>Number.isFinite(Number(r?.km))&&Number(r.km)>0);
 const hm=n>0&&routes.every(r=>r?.hm!==null&&r?.hm!==undefined&&r?.hm!==''&&Number.isFinite(Number(r.hm)));
 const location=n>0&&routes.every(r=>(r?.startLocation||event?.startLocation)&&(r?.country||event?.country));
 const hasSource=sources.some(s=>/^https?:\/\//i.test(String(s?.url||'')));
 const read=sources.some(s=>s?.status==='read'||s?.verification==='manual-official-page');
 const checked=dateOf(record?.checkedAt),age=checked?Math.floor((Date.now()-checked.getTime())/86400000):null;
 const freshness=age===null?'unknown':age<=30?'fresh':age<=90?'stale':'old';
 const checks=[datePresent,km,hm,location,hasSource],coverage=Math.round(checks.filter(Boolean).length/checks.length*100),warnings=[];
 if(!datePresent)warnings.push('Datum fehlt');else if(!dateVerified)warnings.push('Datum nicht offiziell bestätigt');
 if(!km)warnings.push('Distanzen unvollständig');if(!hm)warnings.push('Höhenmeter unvollständig');if(!location)warnings.push('Startort/Land unvollständig');
 if(!hasSource)warnings.push('Quelle fehlt');else if(!read)warnings.push('Quellseite nicht erfolgreich gelesen');
 if(age===null)warnings.push('Prüfdatum fehlt');else if(age>30)warnings.push('Prüfung vor '+age+' Tagen');
 return {routes:n,coverage,datePresent,dateVerified,km,hm,location,hasSource,read,age,freshness,warnings,
  profiles:routes.filter(r=>r?.elevationProfile||r?.profilePoints||r?.profileUrl).length,
  cutoffs:routes.filter(r=>r?.cutoffs?.length||Number(r?.maxh)>0).length};
}
let feed=null,feedPromise=null;
async function getFeed(){if(feed)return feed;if(!feedPromise)feedPromise=fetch(new URL('event-dates.json',document.baseURI),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Prüfdaten nicht erreichbar');return r.json();}).then(x=>feed=x).catch(e=>{console.warn('NORTHBOUND Eventprüfung:',e);return feed={events:{}};});return feedPromise;}
function badge(label,kind){const b=document.createElement('span');b.className='nb-quality-badge '+kind;b.textContent=label;return b;}
function renderQuality(){
 const eventsRoot=document.getElementById('events'),host=document.getElementById('eventsTab')||eventsRoot?.parentElement;if(!host||typeof EVENTS==='undefined')return;
 let panel=document.getElementById(QUALITY_ID);if(!panel){panel=document.createElement('section');panel.id=QUALITY_ID;panel.className='nb-insight-panel nb-quality-panel';if(eventsRoot&&eventsRoot.parentElement===host)host.insertBefore(panel,eventsRoot);else host.prepend(panel);}
 const records=feed?.events||{},rows=EVENTS.map(event=>({event,q:quality(event,records[event?.id]),record:records[event?.id]}));
 panel.replaceChildren();const header=document.createElement('div');header.className='nb-insight-head';const intro=document.createElement('div');intro.innerHTML='<span class="nb-eyebrow">NORTHBOUND · DATENBANK</span><h3>Event-Qualitätsanzeige</h3><p>Datenabdeckung, Quellenprüfung und Aktualität getrennt prüfen. Fehlende optionale GPX-Dateien oder Profile werden nicht automatisch als Fehler gewertet.</p>';header.append(intro);panel.append(header);
 const stale=rows.filter(x=>['stale','old','unknown'].includes(x.q.freshness)).length,review=rows.filter(x=>x.q.warnings.length).length;
 const stats=document.createElement('div');stats.className='nb-quality-stats';[[rows.length,'Events'],[review,'mit Prüfhinweisen'],[stale,'Prüfung älter als 30 Tage / unbekannt']].forEach(([v,l])=>{const card=document.createElement('div');card.className='nb-quality-stat';const b=document.createElement('b');b.textContent=v;const s=document.createElement('span');s.textContent=l;card.append(b,s);stats.append(card);});panel.append(stats);
 const controls=document.createElement('div');controls.className='nb-quality-controls';const search=document.createElement('input');search.type='search';search.placeholder='Event suchen …';search.setAttribute('aria-label','Events suchen');const filter=document.createElement('select');filter.setAttribute('aria-label','Qualitätsstatus filtern');
 [['all','Alle Events'],['review','Prüfung erforderlich'],['stale','Prüfung veraltet / fehlt'],['verified','Datum bestätigt']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;filter.append(o);});controls.append(search,filter);panel.append(controls);
 const list=document.createElement('div');list.className='nb-quality-list';panel.append(list);
 const draw=()=>{list.replaceChildren();const query=search.value.trim().toLocaleLowerCase('de');const found=rows.filter(x=>(!query||((x.event.name||'')+' '+x.event.id).toLocaleLowerCase('de').includes(query))&&(filter.value!=='review'||x.q.warnings.length)&&(filter.value!=='stale'||['stale','old','unknown'].includes(x.q.freshness))&&(filter.value!=='verified'||x.q.dateVerified)).sort((a,b)=>a.q.coverage-b.q.coverage||(a.q.age??9999)-(b.q.age??9999));
 if(!found.length){const p=document.createElement('p');p.className='nb-insight-empty';p.textContent='Keine passenden Events gefunden.';list.append(p);return;}
 found.forEach(x=>{const d=document.createElement('details');d.className='nb-quality-row';const summary=document.createElement('summary');const name=document.createElement('b');name.textContent=x.event.name||x.event.id;const score=document.createElement('strong');score.className='nb-quality-score';score.textContent=x.q.coverage+' %';const fresh=x.q.freshness==='fresh'?'Aktuell':x.q.freshness==='unknown'?'Prüfung unbekannt':x.q.freshness==='stale'?'Prüfung älter':'Prüfung veraltet';summary.append(name,score,badge(fresh,x.q.freshness));d.append(summary);
 const detail=document.createElement('div');detail.className='nb-quality-detail';
 const items=[['Datum',x.q.dateVerified?'Offiziell bestätigt':x.q.datePresent?'Vorhanden, nicht bestätigt':'Fehlt',x.q.dateVerified?'good':x.q.datePresent?'warn':'bad'],['Distanzen',x.q.km?'Alle Strecken vorhanden':'Unvollständig',x.q.km?'good':'bad'],['Höhenmeter',x.q.hm?'Alle Strecken vorhanden':'Unvollständig',x.q.hm?'good':'bad'],['Startort / Land',x.q.location?'Vollständig':'Unvollständig',x.q.location?'good':'warn'],['Quelle',!x.q.hasSource?'Nicht hinterlegt':x.q.read?'Offizielle Seite gelesen':'Nicht erfolgreich gelesen',x.q.read?'good':x.q.hasSource?'warn':'bad'],['Letzte Prüfung',x.q.age===null?'Nicht dokumentiert':dateLabel(dateOf(x.record?.checkedAt))+' · vor '+x.q.age+' Tagen',x.q.freshness==='fresh'?'good':x.q.freshness==='unknown'?'warn':'bad'],['Streckenprofile',x.q.profiles+' / '+x.q.routes+' Strecken','neutral'],['Cut-off-Daten',x.q.cutoffs+' / '+x.q.routes+' Strecken','neutral']];
 items.forEach(([label,value,kind])=>{const line=document.createElement('div');line.className='nb-quality-detail-line';const l=document.createElement('span');l.textContent=label;const v=document.createElement('b');v.textContent=value;v.className='nb-quality-value '+kind;line.append(l,v);detail.append(line);});
 if(x.q.warnings.length){const w=document.createElement('p');w.className='nb-quality-warnings';w.textContent='Prüfhinweise: '+x.q.warnings.join(' · ');detail.append(w);}d.append(detail);list.append(d);
 });};
 search.addEventListener('input',draw);filter.addEventListener('change',draw);draw();
 const note=document.createElement('p');note.className='nb-insight-footnote';note.textContent='Datenabdeckung misst vorhandene Kernfelder, nicht die sportliche Qualität eines Events. Quelle und Prüfdatum stammen aus event-dates.json. Cut-off und Profil werden separat informativ ausgewiesen.';panel.append(note);
}
function styles(){
 if(document.getElementById('northbound-insights-css'))return;
 const s=document.createElement('style');s.id='northbound-insights-css';s.textContent=String.raw`
 .nb-insight-panel{margin:16px 0;padding:16px;border:1px solid #344452;border-radius:16px;background:linear-gradient(145deg,#111b25,#0d141c);color:#F5F7FA;box-shadow:0 8px 24px rgba(0,0,0,.16)}
 .nb-insight-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}.nb-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#7FD8FF}
 .nb-insight-panel h3{margin:5px 0;font-size:19px;color:#F5F7FA}.nb-insight-panel h4{margin:16px 0 9px;font-size:14px;color:#F5F7FA}.nb-insight-panel p{margin:5px 0;color:#AEBBC7;font-size:12px;line-height:1.5}
 .nb-recovery-setting{display:grid;gap:6px;min-width:160px;color:#C9D5DF;font-size:11px;font-weight:700}.nb-recovery-setting label{display:grid;gap:5px}.nb-recovery-setting input,.nb-quality-controls input,.nb-quality-controls select{width:100%;min-height:44px;padding:9px 11px;border:1px solid #405363;border-radius:10px;background:#0B1117;color:#F5F7FA;font:inherit;font-size:14px}.nb-recovery-setting button{min-height:42px;border:1px solid #FF6A00;border-radius:10px;background:#FF6A00;color:#111820;font-weight:800}
 .nb-insight-status{min-height:18px;color:#7FD8FF!important}.nb-insight-empty{padding:13px;border:1px dashed #405363;border-radius:10px}.nb-recovery-last{display:grid;gap:4px;margin-top:12px;padding:12px;border-left:3px solid #7FD8FF;border-radius:8px;background:#17232e}.nb-recovery-last strong{font-size:14px}.nb-recovery-last span{font-size:11px;color:#AEBBC7}
 .nb-recovery-timeline{display:flex;gap:5px;margin-top:12px;min-width:0}.nb-recovery-phase{display:grid;align-content:center;gap:5px;min-width:0;min-height:66px;padding:9px;border:1px solid #405363;border-radius:9px}.nb-recovery-phase b{font-size:11px;line-height:1.25}.nb-recovery-phase small{font-size:10px;color:#C0CCD6}.nb-recovery-phase.one{background:#24303b;border-top:3px solid #7FD8FF}.nb-recovery-phase.two{background:#202832;border-top:3px solid #8997A5}.nb-recovery-phase.three{background:#30251f;border-top:3px solid #FF6A00}
 .nb-recovery-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nb-recovery-suggestion{display:grid;gap:4px;padding:11px;border:1px solid #344452;border-radius:10px;background:#141f29;min-width:0}.nb-recovery-suggestion b{font-size:12px;line-height:1.35}.nb-recovery-suggestion span{font-size:10px;line-height:1.4;color:#AEBBC7}.nb-insight-footnote{margin-top:12px!important;font-size:10px!important;color:#8797A5!important}
 .nb-quality-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.nb-quality-stat{display:grid;gap:3px;min-width:0;padding:11px;border:1px solid #344452;border-radius:10px;background:#141f29}.nb-quality-stat b{font-size:20px;color:#7FD8FF}.nb-quality-stat span{font-size:10px;line-height:1.35;color:#AEBBC7}
 .nb-quality-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,.42fr);gap:8px;margin:12px 0}.nb-quality-list{display:grid;gap:7px}.nb-quality-row{border:1px solid #344452;border-radius:10px;background:#141f29;overflow:hidden}.nb-quality-row>summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;min-height:48px;padding:10px 12px;cursor:pointer;list-style:none}.nb-quality-row>summary::-webkit-details-marker{display:none}.nb-quality-row>summary b{font-size:12px;line-height:1.35;overflow-wrap:anywhere}.nb-quality-score{font-size:13px;color:#FF9A4A;font-variant-numeric:tabular-nums}
 .nb-quality-badge{padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap;border:1px solid}.nb-quality-badge.fresh{color:#7FD8FF;border-color:#42667b;background:#1b2d3a}.nb-quality-badge.stale,.nb-quality-badge.old{color:#FFB36B;border-color:#80552f;background:#30251f}.nb-quality-badge.unknown{color:#B5C0CA;border-color:#53606b;background:#242d35}
 .nb-quality-detail{display:grid;gap:0;padding:4px 12px 12px;border-top:1px solid #344452}.nb-quality-detail-line{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #293744;font-size:10px}.nb-quality-detail-line>span{color:#AEBBC7}.nb-quality-value{text-align:right}.nb-quality-value.good{color:#7FD8FF}.nb-quality-value.warn{color:#FFB36B}.nb-quality-value.bad,.nb-quality-warnings{color:#FF786B!important}.nb-quality-value.neutral{color:#AEBBC7}
 @media(max-width:600px){.nb-insight-panel{padding:12px;margin:12px 0}.nb-insight-head{display:grid}.nb-recovery-setting{grid-template-columns:minmax(0,1fr);width:100%}.nb-recovery-timeline{flex-direction:column}.nb-recovery-phase{min-height:48px}.nb-recovery-suggestions{grid-template-columns:minmax(0,1fr)}.nb-quality-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nb-quality-stat:last-child{grid-column:1/-1}.nb-quality-controls{grid-template-columns:minmax(0,1fr)}.nb-quality-row>summary{grid-template-columns:minmax(0,1fr) auto;gap:7px}.nb-quality-badge{grid-column:1/-1;justify-self:start}}
 @media(prefers-reduced-motion:reduce){.nb-insight-panel *{scroll-behavior:auto!important;transition:none!important}}`;
 document.head.append(s);
}
async function mountQuality(){styles();await getFeed();renderQuality();}
function mount(){styles();recoveryPanel();mountQuality();}
const previous=window.renderSeasonEnhancements;
if(typeof previous==='function')window.renderSeasonEnhancements=function(){previous();recoveryPanel();};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
if(typeof MutationObserver!=='undefined'){const observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length)){if(!document.getElementById(RECOVERY_ID))recoveryPanel();if(!document.getElementById(QUALITY_ID))mountQuality();}});const watch=()=>{if(document.body)observer.observe(document.body,{childList:true,subtree:true});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();}
window.NorthboundInsights={quality,lastRace,suggestions,settings};
})();