(()=>{'use strict';
const STORE='__trainingSettings';
const defaults={weeklyKm:35,weeklyHm:1000,sessions:4,longRun:18,notes:''};
function settings(){return {...defaults,...(seasonPriorities[STORE]||{})};}
function dayKey(d){const x=new Date(d);return Number.isNaN(x.getTime())?'':x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function load(){const now=new Date(),start=startOfWeek(now),prev=new Date(start);prev.setDate(prev.getDate()-7);const rows=[];Object.values(runAttempts||{}).forEach(list=>(Array.isArray(list)?list:[]).forEach(a=>{if(!a||!a.done||!a.date)return;const date=new Date(a.date+'T12:00:00');if(!Number.isNaN(date.getTime()))rows.push({date,km:Number(a.actualKm)||0,hm:Number(a.actualHm)||0,h:(Number(a.hours)||0)+(Number(a.minutes)||0)/60});}));const sum=(from,to)=>rows.filter(x=>x.date>=from&&x.date<to).reduce((v,x)=>({km:v.km+x.km,hm:v.hm+x.hm,h:v.h+x.h,count:v.count+1}),{km:0,hm:0,h:0,count:0});const end=new Date(start);end.setDate(end.getDate()+7);const priorEnd=new Date(start);return {current:sum(start,end),previous:sum(prev,priorEnd),rows:rows.length};}
function escText(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function panel(){const d=settings(),v=load(),pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0,delta=v.previous.km>0?Math.round((v.current.km-v.previous.km)/v.previous.km*100):null;return '<section class="season-training-panel"><h3>📊 Trainingssteuerung – Wochenüberblick</h3><p class="plan-meta">Auswertung deiner als gelaufen gespeicherten Aktivitäten. Ziele sind deine eigenen Planwerte, keine automatische Trainingsvorgabe.</p><div class="season-training-grid"><div><b>'+v.current.km.toFixed(1)+' / '+Number(d.weeklyKm||0)+' km</b><span>Diese Woche</span><div class="season-training-track"><i style="width:'+pct(v.current.km,Number(d.weeklyKm))+'%"></i></div></div><div><b>'+Math.round(v.current.hm)+' / '+Number(d.weeklyHm||0)+' hm</b><span>Höhenmeter diese Woche</span><div class="season-training-track"><i style="width:'+pct(v.current.hm,Number(d.weeklyHm))+'%"></i></div></div><div><b>'+v.current.count+' / '+Number(d.sessions||0)+'</b><span>Einheiten diese Woche</span><div class="season-training-track"><i style="width:'+pct(v.current.count,Number(d.sessions))+'%"></i></div></div><div><b>'+v.current.h.toFixed(1)+' h</b><span>Trainingszeit diese Woche</span><small>'+Math.round(v.current.hm)+' hm · '+v.current.km.toFixed(1)+' km</small></div></div><p class="plan-meta">'+(delta===null?'Für die Vorwoche liegen keine vergleichbaren Laufdaten vor.':'Distanz gegenüber Vorwoche: '+(delta>0?'+':'')+delta+' %'+(delta>=30?' · deutlicher Anstieg – Belastung und Erholung bewusst prüfen.':delta<=-30?' · deutlich weniger Umfang als in der Vorwoche.':''))+'</p><details class="season-training-settings"><summary>Meine Trainingsziele anpassen</summary><div class="edit-grid"><label>Wochenkilometer<input type="number" min="0" max="500" step="1" data-train-setting="weeklyKm" value="'+escText(d.weeklyKm)+'"></label><label>Höhenmeter pro Woche<input type="number" min="0" max="20000" step="100" data-train-setting="weeklyHm" value="'+escText(d.weeklyHm)+'"></label><label>Einheiten pro Woche<input type="number" min="0" max="14" step="1" data-train-setting="sessions" value="'+escText(d.sessions)+'"></label><label>Langer Lauf (km)<input type="number" min="0" max="150" step="1" data-train-setting="longRun" value="'+escText(d.longRun)+'"></label></div><label class="season-training-note">Hinweise / Schwerpunkt<textarea rows="2" data-train-setting="notes">'+escText(d.notes)+'</textarea></label><button type="button" class="secondary" id="saveSeasonTraining">Trainingsziele speichern</button><p class="plan-meta" id="seasonTrainingStatus" aria-live="polite"></p></details><p class="plan-meta">Vorwoche: '+v.previous.km.toFixed(1)+' km · '+Math.round(v.previous.hm)+' hm · '+v.previous.count+' Einheiten. Insgesamt erfasste Läufe: '+v.rows+'. Fehlende Aktivitäten werden nicht als Nulltraining interpretiert.</p></section>';}
const css=document.createElement('style');css.textContent='.season-training-panel{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.season-training-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.season-training-grid>div{padding:10px;border:1px solid var(--line);border-radius:10px;min-width:0}.season-training-grid b,.season-training-grid span,.season-training-grid small{display:block}.season-training-grid b{font-size:16px}.season-training-grid span,.season-training-grid small{font-size:11px;color:var(--muted)}.season-training-track{height:7px;background:var(--line);border-radius:8px;overflow:hidden;margin-top:7px}.season-training-track i{display:block;height:100%;background:var(--green)}.season-training-settings{margin-top:12px}.season-training-settings summary{cursor:pointer;font-weight:700;color:var(--green);padding:8px 0}.season-training-note{display:block;font-size:12px;font-weight:700;color:var(--muted)}.season-training-note textarea{display:block;width:100%;margin:5px 0 9px;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}@media(max-width:380px){.season-training-grid{grid-template-columns:1fr}}';document.head.appendChild(css);
const original=window.renderSeasonEnhancements;if(typeof original!=='function')return;
window.renderSeasonEnhancements=function(){original();const root=document.getElementById('seasonTimeline');if(!root)return;root.querySelector('.season-training-panel')?.remove();root.insertAdjacentHTML('afterbegin',panel());const save=document.getElementById('saveSeasonTraining');save?.addEventListener('click',()=>{const next={...settings()};document.querySelectorAll('[data-train-setting]').forEach(el=>{const k=el.dataset.trainSetting;next[k]=k==='notes'?el.value:Math.max(0,Number(el.value)||0);});if(next.weeklyKm>500||next.weeklyHm>20000||next.sessions>14||next.longRun>150){document.getElementById('seasonTrainingStatus').textContent='Bitte prüfe die eingegebenen Zielwerte.';return;}seasonPriorities[STORE]=next;seasonSave();document.getElementById('seasonTrainingStatus').textContent='Trainingsziele gespeichert und mit deiner Saisonplanung synchronisiert.';});};
window.renderSeasonEnhancements();


/* Group the existing annual race cards into compact, accessible month accordions.
   The canonical season dashboard is rendered by index.html; do not duplicate it here. */
const originalYearOverview=window.renderYearOverview;
if(typeof originalYearOverview==='function'){
 const groupYearMonths=()=>{
  const root=document.getElementById('yearOverview');if(!root)return;
  root.querySelectorAll('.year-group').forEach(yearGroup=>{
   if(yearGroup.querySelector(':scope > .year-month-list'))return;
   const races=Array.from(yearGroup.querySelectorAll(':scope > .year-race'));
   if(!races.length)return;
   const buckets=new Map();
   races.forEach(article=>{
    const text=article.querySelector('.year-race-meta')?.textContent||'';
    const match=text.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    let key='undated',date=null,label='Termin offen';
    if(match){
     const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
     date=new Date(Date.UTC(year,month-1,day));
     if(!Number.isNaN(date.getTime())){
      key=year+'-'+String(month).padStart(2,'0');
      label=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
      label=label.charAt(0).toLocaleUpperCase('de-DE')+label.slice(1);
     }
    }
    if(!buckets.has(key))buckets.set(key,{key,label,date,races:[]});
    buckets.get(key).races.push(article);
   });
   const groups=Array.from(buckets.values()).sort((a,b)=>{
    if(a.key==='undated')return 1;if(b.key==='undated')return -1;return a.key.localeCompare(b.key);
   });
   const today=new Date(),currentKey=today.getUTCFullYear()+'-'+String(today.getUTCMonth()+1).padStart(2,'0');
   let active=groups.find(g=>g.key===currentKey);
   if(!active)active=groups.find(g=>g.date&&g.date.getTime()>=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
   if(!active)active=[...groups].reverse().find(g=>g.key!=='undated')||groups[0];
   const list=document.createElement('div');list.className='year-month-list';
   const monthNav=document.createElement('nav');monthNav.className='year-month-nav';monthNav.setAttribute('aria-label','Monatsnavigation');
   groups.forEach(g=>{
    const details=document.createElement('details');details.className='year-month-group';details.dataset.monthKey=g.key;details.id='month_'+String(yearGroup.id||'year').replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+g.key.replace(/[^a-zA-Z0-9_-]/g,'_');details.open=g===active;
    const chip=document.createElement('button');chip.type='button';chip.className='year-month-chip'+(g===active?' is-active':'');chip.dataset.monthTarget=g.key;chip.setAttribute('aria-label','Zum Monat '+g.label+' springen');chip.title=g.label;chip.textContent=(g.date?new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'UTC'}).format(g.date).replace('.',''): 'Offen')+' · '+g.races.length;monthNav.appendChild(chip);
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.className='year-month-title';title.textContent=g.label;
    const count=document.createElement('span');count.className='year-month-count';count.textContent=g.races.length+' '+(g.races.length===1?'Rennen':'Rennen');
    summary.append(title,count);details.appendChild(summary);
    const content=document.createElement('div');content.className='year-month-races';
    g.races.forEach(article=>content.appendChild(article));
    details.appendChild(content);list.appendChild(details);
   });
   const totals=yearGroup.querySelector(':scope > .year-totals');
   if(totals){yearGroup.insertBefore(monthNav,totals);yearGroup.insertBefore(list,totals);}else{yearGroup.appendChild(monthNav);yearGroup.appendChild(list);}
   monthNav.addEventListener('click',event=>{const chip=event.target.closest('[data-month-target]');if(!chip)return;const target=Array.from(list.children).find(node=>node.dataset.monthKey===chip.dataset.monthTarget);if(!target)return;list.querySelectorAll('.year-month-group').forEach(node=>node.open=node===target);monthNav.querySelectorAll('.year-month-chip').forEach(node=>{const selected=node===chip;node.classList.toggle('is-active',selected);if(selected)node.setAttribute('aria-current','true');else node.removeAttribute('aria-current');});target.scrollIntoView({behavior:'smooth',block:'start'});});
   list.querySelectorAll('.year-month-group').forEach(details=>details.addEventListener('toggle',()=>{
    if(!details.open)return;
    monthNav.querySelectorAll('.year-month-chip').forEach(chip=>{
     const selected=chip.dataset.monthTarget===details.dataset.monthKey;
     chip.classList.toggle('is-active',selected);
     if(selected)chip.setAttribute('aria-current','true');else chip.removeAttribute('aria-current');
    });
   }));
  });
 };
 window.renderYearOverview=function(){originalYearOverview();groupYearMonths();};
 const style=document.createElement('style');
 style.textContent='.year-month-nav{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 8px;margin:8px 0 2px;scrollbar-width:none}.year-month-nav::-webkit-scrollbar{display:none}.year-month-chip{flex:0 0 auto;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer}.year-month-chip.is-active{border-color:var(--green);background:rgba(63,113,78,.24);color:var(--ink)}.year-month-list{display:grid;gap:8px;margin:10px 0 12px}.year-month-group{border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--card) 82%,transparent);overflow:hidden}.year-month-group>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;padding:12px 13px;font-size:13px;font-weight:750;color:var(--ink)}.year-month-group[open]{border-color:color-mix(in srgb,var(--green) 40%,var(--line));box-shadow:0 7px 20px rgba(0,0,0,.12)}.year-race{padding:12px 0;border-top:1px solid var(--line)}.year-race-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.year-race-head>strong{font-size:14px;line-height:1.35;letter-spacing:-.01em}.year-race-head>.secondary{flex:none;min-width:36px;min-height:36px;padding:5px 9px}.year-race-meta{margin:5px 0 9px;font-size:11px;line-height:1.5;color:var(--muted)}.year-race-status-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}.year-race-status{display:grid;gap:4px;min-width:0;font-size:10px;font-weight:750;color:var(--muted)}.year-race-status select{width:100%;min-width:0;min-height:38px;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:11px}.year-race-more{margin-top:7px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.06)}.year-race-more>summary{padding:9px 11px;cursor:pointer;font-size:11px;font-weight:750;color:var(--green);list-style:none}.year-race-more>summary::-webkit-details-marker{display:none}.year-race-more>summary:after{content:'+';float:right;font-size:15px}.year-race-more[open]>summary:after{content:'−'}.year-race-more-content{padding:0 10px 10px}.year-race-more:focus-within{border-color:var(--green)}@media(max-width:420px){.year-race-status-controls{grid-template-columns:1fr 1fr;gap:6px}.year-race-status select{font-size:10px;padding:5px}}.year-month-group>summary::-webkit-details-marker{display:none}.year-month-group>summary::after{content:"+";font-size:17px;color:var(--green);line-height:1}.year-month-group[open]>summary::after{content:"−"}.year-month-title{min-width:0}.year-month-count{flex:none;color:var(--muted);font-size:11px;font-weight:600}.year-month-races{padding:0 12px 10px}.year-month-races .year-race:first-child{border-top:1px solid var(--line)}.year-month-group>summary:focus-visible{outline:2px solid var(--lime);outline-offset:-3px;border-radius:10px}@media(prefers-reduced-motion:no-preference){.year-month-group .year-month-races{animation:yearMonthReveal .16s ease-out}@keyframes yearMonthReveal{from{opacity:.6;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}}';
 document.head.appendChild(style);
}

})();