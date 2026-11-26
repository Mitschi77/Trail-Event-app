(()=>{'use strict';
const STORE='__trainingSettings';
const defaults={weeklyKm:35,weeklyHm:1000,sessions:4,longRun:18,notes:''};
function settings(){return {...defaults,...(seasonPriorities[STORE]||{})};}
function dayKey(d){const x=new Date(d);return Number.isNaN(x.getTime())?'':x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function load(){const now=new Date(),start=startOfWeek(now),prev=new Date(start);prev.setDate(prev.getDate()-7);const rows=[];Object.values(runAttempts||{}).forEach(list=>(Array.isArray(list)?list:[]).forEach(a=>{if(!a||!a.done||!a.date)return;const date=new Date(a.date+'T12:00:00');if(!Number.isNaN(date.getTime()))rows.push({date,km:Number(a.actualKm)||0,hm:Number(a.actualHm)||0,h:(Number(a.hours)||0)+(Number(a.minutes)||0)/60});}));const sum=(from,to)=>rows.filter(x=>x.date>=from&&x.date<to).reduce((v,x)=>({km:v.km+x.km,hm:v.hm+x.hm,h:v.h+x.h,count:v.count+1}),{km:0,hm:0,h:0,count:0});const end=new Date(start);end.setDate(end.getDate()+7);const priorEnd=new Date(start);return {current:sum(start,end),previous:sum(prev,priorEnd),rows:rows.length};}
function escText(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function panel(){
 const d=settings(),v=load();
 const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
 const fmt=n=>Number(n||0).toLocaleString('de-DE',{maximumFractionDigits:1});
 const delta=(current,previous)=>previous>0?Math.round((current-previous)/previous*100):null;
 const kmPct=pct(v.current.km,Number(d.weeklyKm));
 const hmPct=pct(v.current.hm,Number(d.weeklyHm));
 const sessionPct=pct(v.current.count,Number(d.sessions));
 const timeDelta=delta(v.current.h,v.previous.h);
 const compare=(label,current,previous,unit,accent)=>{
  const max=Math.max(current,previous,1),a=Math.round(current/max*100),b=Math.round(previous/max*100);
  return '<div class="season-training-compare-row"><span>'+label+'</span><div class="season-training-compare-bars"><i class="previous" style="--bar-width:'+b+'%"></i><i class="current '+accent+'" style="--bar-width:'+a+'%"></i></div><b>'+fmt(current)+' '+unit+'</b></div>';
 };
 const ring=(value,label,detail,progress,accent)=>'<article class="season-training-visual"><div class="season-training-ring '+accent+'" style="--ring-value:'+progress+'%" role="img" aria-label="'+label+': '+value+'; '+progress+' Prozent des eigenen Wochenziels"><div><strong>'+progress+'%</strong><span>Ziel</span></div></div><div class="season-training-visual-copy"><strong>'+value+'</strong><span>'+label+'</span><small>'+detail+'</small></div></article>';
 return '<section class="season-training-panel"><div class="season-training-heading"><div><span class="nb-eyebrow">NORTHBOUND · TRAINING</span><h3>Deine Trainingswoche</h3><p>Deine gespeicherten Aktivitäten im Vergleich zu deinen selbst gesetzten Wochenzielen.</p></div><span class="season-training-period">AKTUELLE WOCHE</span></div><div class="season-training-visual-grid">'+
 ring(fmt(v.current.km)+' km','Distanz',fmt(d.weeklyKm)+' km Wochenziel',kmPct,'is-orange')+
 ring(Math.round(v.current.hm).toLocaleString('de-DE')+' hm','Höhenmeter',Math.round(d.weeklyHm).toLocaleString('de-DE')+' hm Wochenziel',hmPct,'is-ice')+
 ring(v.current.count+' / '+d.sessions,'Einheiten',d.sessions+' Einheiten Wochenziel',sessionPct,'is-orange')+
 '<article class="season-training-time"><span>TRAININGSZEIT</span><strong>'+v.current.h.toFixed(1).replace('.',',')+' h</strong><small>'+ (timeDelta===null?'Noch kein Vorwochenvergleich':(timeDelta>0?'+':'')+timeDelta+' % zur Vorwoche')+'</small><div class="season-training-time-track"><i style="--bar-width:'+Math.min(100,Math.round(v.current.h/Math.max(v.current.h,v.previous.h,0.1)*100))+'%"></i></div></article></div>'+
 '<div class="season-training-trends"><div class="season-training-trends-head"><strong>Wochenvergleich</strong><span><i></i> Vorwoche <i class="now"></i> Diese Woche</span></div>'+
 compare('Distanz',v.current.km,v.previous.km,'km','is-orange')+
 compare('Höhenmeter',v.current.hm,v.previous.hm,'hm','is-ice')+
 compare('Einheiten',v.current.count,v.previous.count,'','is-orange')+
 '</div><p class="season-training-note">Vorwoche: '+fmt(v.previous.km)+' km · '+Math.round(v.previous.hm).toLocaleString('de-DE')+' hm · '+v.previous.count+' Einheiten. Insgesamt erfasste Läufe: '+v.rows+'. Die Anzeige ist eine Rückschau, keine automatische Trainingsvorgabe.</p>'+
 '<details class="season-training-settings"><summary>Wochenziele anpassen</summary><div class="edit-grid"><label>Wochenkilometer<input type="number" min="0" max="500" step="1" data-train-setting="weeklyKm" value="'+escText(d.weeklyKm)+'"></label><label>Höhenmeter pro Woche<input type="number" min="0" max="20000" step="100" data-train-setting="weeklyHm" value="'+escText(d.weeklyHm)+'"></label><label>Einheiten pro Woche<input type="number" min="0" max="14" step="1" data-train-setting="sessions" value="'+escText(d.sessions)+'"></label><label>Langer Lauf (km)<input type="number" min="0" max="150" step="1" data-train-setting="longRun" value="'+escText(d.longRun)+'"></label></div><label class="season-training-note">Hinweise / Schwerpunkt<textarea rows="2" data-train-setting="notes">'+escText(d.notes)+'</textarea></label><button type="button" class="secondary" id="saveSeasonTraining">Trainingsziele speichern</button><p class="plan-meta" id="seasonTrainingStatus" aria-live="polite"></p></details></section>';
}
const css=document.createElement('style');css.textContent='.season-training-panel{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.season-training-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.season-training-grid>div{padding:10px;border:1px solid var(--line);border-radius:10px;min-width:0}.season-training-grid b,.season-training-grid span,.season-training-grid small{display:block}.season-training-grid b{font-size:16px}.season-training-grid span,.season-training-grid small{font-size:11px;color:var(--muted)}.season-training-track{height:7px;background:var(--line);border-radius:8px;overflow:hidden;margin-top:7px}.season-training-track i{display:block;height:100%;background:#FF6A00}.season-training-settings{margin-top:12px}.season-training-settings summary{cursor:pointer;font-weight:700;color:#FF6A00;padding:8px 0}.season-training-note{display:block;font-size:12px;font-weight:700;color:var(--muted)}.season-training-note textarea{display:block;width:100%;margin:5px 0 9px;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}@media(max-width:380px){.season-training-grid{grid-template-columns:1fr}}';document.head.appendChild(css);
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
   const formatRaceMeta=article=>{
    const meta=article.querySelector('.year-race-meta');
    if(!meta||meta.dataset.metaFormatted==='1')return;
    const parts=(meta.textContent||'').split(/\\s*(?:·|•|\\|)\\s*/).map(value=>value.trim()).filter(Boolean);
    if(parts.length<2)return;
    meta.replaceChildren();
    parts.forEach(value=>{
     const chip=document.createElement('span');
     chip.className='year-race-meta-item';
     chip.textContent=value;
     if(/\\bUTMB\\s*Index\\b/i.test(value))chip.dataset.metaKind='utmb-index';
     else if(/\\bUTMB\\s*(?:Score|Punkte)\\b/i.test(value))chip.dataset.metaKind='utmb-score';
     else if(/\\b(?:UTMB\\s*World\\s*Series|by\\s*UTMB)\\b/i.test(value))chip.dataset.metaKind='utmb-series';
     else if(/\\b(?:sold[ -]?out|ausverkauft|ausgebucht)\\b/i.test(value))chip.dataset.metaKind='soldout';
     else if(/\\b(?:cut[ -]?off|kontrollzeiten|zeitlimit)\\b/i.test(value))chip.dataset.metaKind='cutoff';
     else if(/\\b(?:max(?:imal)?\\.?\\s*\\d+(?:[.,]\\d+)?\\s*h|\\d+(?:[.,]\\d+)?\\s*h\\s*max)\\b/i.test(value))chip.dataset.metaKind='time-limit';
     else if(/\\b\\d{2}\\.\\d{2}\\.\\d{4}\\b/.test(value))chip.dataset.metaKind='date';
     else if(/\\b\\d+(?:[.,]\\d+)?\\s*km\\b/i.test(value))chip.dataset.metaKind='distance';
     else if(/\\b\\d+(?:[.,]\\d+)?\\s*(?:hm|m\\s*\\+?)\\b/i.test(value))chip.dataset.metaKind='elevation';
     else if(/\\b(?:backyard|marathon|halbmarathon|trail|ultra)\\b/i.test(value))chip.dataset.metaKind='type';

     chip.setAttribute('aria-label',value);
     chip.title=value;
     meta.append(chip);
    });
    meta.dataset.metaFormatted='1';
   };
   races.forEach(formatRaceMeta);
   races.forEach(article=>{
    const raw=article.querySelector('.year-race-meta')?.textContent||'';
    if(/\\b(?:sold[ -]?out|ausverkauft|ausgebucht)\\b/i.test(raw)&&!article.querySelector('.sold-out-stamp')){
     const stamp=document.createElement('span');
     stamp.className='sold-out-stamp sold-out-overview';
     stamp.textContent='SOLD OUT';
     stamp.setAttribute('aria-label','Veranstaltung ausverkauft');
     const head=article.querySelector('.year-race-head');
     if(head)head.append(stamp);
    }
   });

   const raceDates=races.map(article=>{
    const text=article.querySelector('.year-race-meta')?.textContent||'';
    const match=text.match(/\\b(\\d{2})\\.(\\d{2})\\.(\\d{4})\\b/);
    if(!match)return null;
    const date=new Date(Date.UTC(Number(match[3]),Number(match[2])-1,Number(match[1])));
    return Number.isNaN(date.getTime())?null:{article,date};
   }).filter(Boolean).sort((a,b)=>a.date-b.date);
   const dayMs=86400000;
   raceDates.forEach((entry,index)=>{
    const next=raceDates[index+1];
    if(!next)return;
    const gap=Math.round((next.date-entry.date)/dayMs);
    const sameDate=gap===0;
    if(!sameDate&&gap>21)return;
    const notice=document.createElement('p');
    notice.className='year-race-spacing'+(sameDate?' is-conflict':' is-close');
    notice.setAttribute('role',sameDate?'status':'note');
    notice.textContent=sameDate?'⚠ Terminüberschneidung mit einem weiteren Rennen':'↔ '+gap+' '+(gap===1?'Tag':'Tage')+' bis zum nächsten Rennen';
    entry.article.appendChild(notice);
   });


   const seasonSummary=document.createElement('div');
   seasonSummary.className='year-season-summary';
   seasonSummary.setAttribute('aria-label','Zusammenfassung der Jahresplanung');
   const datedGroups=groups.filter(group=>group.key!=='undated');
   const undatedCount=groups.find(group=>group.key==='undated')?.races.length||0;
   const summaryItem=(value,label)=>{const item=document.createElement('span');item.className='year-season-summary-item';const strong=document.createElement('strong');strong.textContent=String(value);const caption=document.createElement('small');caption.textContent=label;item.append(strong,caption);return item;};

   const seasonYear=datedGroups[0]?.key.slice(0,4)||((yearGroup.textContent||'').match(/\\b20\\d{2}\\b/)||[])[0];
   if(seasonYear){
    const historyRows=[];
    Object.values(runAttempts||{}).forEach(list=>(Array.isArray(list)?list:[]).forEach(attempt=>{
     if(!attempt||!attempt.done||!attempt.date)return;
     const match=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String(attempt.date));
     if(!match||match[1]!==seasonYear)return;
     historyRows.push({km:Number(attempt.actualKm)||0,hm:Number(attempt.actualHm)||0});
    }));
    if(historyRows.length){
     const totalKm=historyRows.reduce((sum,row)=>sum+row.km,0);
     const totalHm=historyRows.reduce((sum,row)=>sum+row.hm,0);
     const historyItems=[
      summaryItem(historyRows.length,historyRows.length===1?'Lauf absolviert':'Läufe absolviert'),
      summaryItem(totalKm.toFixed(1)+' km','In der Laufhistorie'),
      summaryItem(Math.round(totalHm)+' hm','Erfasste Höhenmeter')
     ];
     historyItems.forEach(item=>{item.dataset.source='history';item.setAttribute('aria-label',item.textContent.replace(/\\s+/g,' ').trim());});
     seasonSummary.append(...historyItems);
    }
   }
   seasonSummary.append(summaryItem(races.length,races.length===1?'Rennen geplant':'Rennen geplant'),summaryItem(datedGroups.length,datedGroups.length===1?'Monat mit Terminen':'Monate mit Terminen'));
   if(undatedCount)seasonSummary.append(summaryItem(undatedCount,undatedCount===1?'Termin offen':'Termine offen'));
   const startGaps=raceDates.slice(1).map((entry,index)=>Math.round((entry.date-raceDates[index].date)/86400000));
   if(startGaps.length){
    const shortestGap=Math.min(...startGaps);
    const tightGaps=startGaps.filter(gap=>gap<14).length;
    seasonSummary.append(summaryItem(shortestGap===0?'0 Tage':shortestGap+' Tage','Kürzester Startabstand'));
    seasonSummary.append(summaryItem(tightGaps,tightGaps===1?'Abstand unter 14 Tagen':'Abstände unter 14 Tagen'));
    const note=document.createElement('p');
    note.className='year-season-summary-note';
    note.textContent='Kalenderabstände zwischen Startterminen – keine automatische Bewertung deiner Regeneration oder Belastbarkeit.';
    seasonSummary.append(note);
   }
   const today=new Date(),currentKey=today.getUTCFullYear()+'-'+String(today.getUTCMonth()+1).padStart(2,'0');
   let active=groups.find(g=>g.key===currentKey);
   if(!active)active=groups.find(g=>g.date&&g.date.getTime()>=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
   if(!active)active=[...groups].reverse().find(g=>g.key!=='undated')||groups[0];
   const list=document.createElement('div');list.className='year-month-list';
   const monthNav=document.createElement('nav');monthNav.className='year-month-nav';monthNav.setAttribute('aria-label','Monatsnavigation');
   groups.forEach(g=>{
    const details=document.createElement('details');details.className='year-month-group';details.dataset.monthKey=g.key;details.id='month_'+String(yearGroup.id||'year').replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+g.key.replace(/[^a-zA-Z0-9_-]/g,'_');details.open=g===active;
    const chip=document.createElement('button');chip.type='button';chip.className='year-month-chip'+(g===active?' is-active':'');chip.dataset.monthTarget=g.key;chip.setAttribute('aria-label','Zum Monat '+g.label+' springen');chip.setAttribute('aria-controls',details.id);chip.setAttribute('aria-expanded',g===active?'true':'false');if(g===active)chip.setAttribute('aria-current','true');chip.title=g.label;chip.textContent=(g.date?new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'UTC'}).format(g.date).replace('.',''): 'Offen')+' · '+g.races.length;monthNav.appendChild(chip);
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.className='year-month-title';title.textContent=g.label;
    const count=document.createElement('span');count.className='year-month-count';count.textContent=g.races.length+' '+(g.races.length===1?'Rennen':'Rennen');
    summary.append(title,count);details.appendChild(summary);
    const content=document.createElement('div');content.className='year-month-races';
    g.races.forEach(article=>content.appendChild(article));
    details.appendChild(content);list.appendChild(details);
   });
   const totals=yearGroup.querySelector(':scope > .year-totals');
   if(totals){yearGroup.insertBefore(seasonSummary,totals);yearGroup.insertBefore(monthNav,totals);yearGroup.insertBefore(list,totals);}else{yearGroup.append(seasonSummary,monthNav,list);}
   monthNav.addEventListener('click',event=>{const chip=event.target.closest('[data-month-target]');if(!chip)return;const target=Array.from(list.children).find(node=>node.dataset.monthKey===chip.dataset.monthTarget);if(!target)return;list.querySelectorAll('.year-month-group').forEach(node=>node.open=node===target);monthNav.querySelectorAll('.year-month-chip').forEach(node=>{const selected=node===chip;node.classList.toggle('is-active',selected);node.setAttribute('aria-expanded',selected?'true':'false');if(selected)node.setAttribute('aria-current','true');else node.removeAttribute('aria-current');});target.scrollIntoView({behavior:'smooth',block:'start'});});
   list.querySelectorAll('.year-month-group').forEach(details=>details.addEventListener('toggle',()=>{
    if(!details.open)return;
    list.querySelectorAll('.year-month-group').forEach(other=>{if(other!==details)other.open=false;});
    monthNav.querySelectorAll('.year-month-chip').forEach(chip=>{
     const selected=chip.dataset.monthTarget===details.dataset.monthKey;
     chip.classList.toggle('is-active',selected);
     chip.setAttribute('aria-expanded',selected?'true':'false');
     if(selected){chip.setAttribute('aria-current','true');chip.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}
     else chip.removeAttribute('aria-current');
    });
   }));
  });
 };
 window.renderYearOverview=function(){originalYearOverview();groupYearMonths();};
 const addYearJumpNavigation=()=>{
  const root=document.getElementById('yearOverview');if(!root)return;
  root.querySelector('.year-overview-nav')?.remove();
  const years=Array.from(root.querySelectorAll(':scope > .year-group')).map(group=>{
   const heading=group.querySelector(':scope > h2,:scope > h3,:scope > .year-title');
   const year=((heading?.textContent||group.textContent||'').match(/\b20\d{2}\b/)||[])[0];
   if(!year)return null;group.id='year-overview-'+year;return {year,group};
  }).filter(Boolean).sort((x,y)=>Number(x.year)-Number(y.year));
  if(!years.length)return;
  const nav=document.createElement('nav');nav.className='year-overview-nav';nav.setAttribute('aria-label','Jahresübersicht – Jahr auswählen');
  const label=document.createElement('span');label.className='year-overview-nav-label';label.textContent='Jahr';nav.append(label);
  years.forEach(({year,group},i)=>{
   const button=document.createElement('button');button.type='button';button.className='year-overview-nav-button';button.textContent=year;button.setAttribute('aria-controls',group.id);
   if(i===0)button.setAttribute('aria-current','true');
   button.addEventListener('click',()=>{nav.querySelectorAll('button').forEach(x=>{if(x===button)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current');});group.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
   nav.append(button);
  });root.prepend(nav);
 };
 const yearRenderer=window.renderYearOverview;
 window.renderYearOverview=function(){yearRenderer();addYearJumpNavigation();};
 const style=document.createElement('style');
 style.textContent=`.year-month-nav{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 8px;margin:8px 0 2px;scrollbar-width:none}.year-month-nav::-webkit-scrollbar{display:none}.year-month-chip{flex:0 0 auto;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer}.year-month-chip.is-active{border-color:#FF6A00;background:rgba(63,96,113,.24);color:var(--ink)}.year-month-list{display:grid;gap:8px;margin:10px 0 12px}.year-month-group{border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--card) 82%,transparent);overflow:hidden}.year-month-group>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;padding:12px 13px;font-size:13px;font-weight:750;color:var(--ink)}.year-month-group[open]{border-color:color-mix(in srgb,#FF6A00 40%,var(--line));box-shadow:0 7px 20px rgba(0,0,0,.12)}.year-race{padding:12px 0;border-top:1px solid var(--line)}.year-race-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.year-race-head>strong{font-size:14px;line-height:1.35;letter-spacing:-.01em}.year-race-head>.secondary{flex:none;min-width:36px;min-height:36px;padding:5px 9px}.year-race-meta{margin:5px 0 9px;font-size:11px;line-height:1.5;color:var(--muted)}.year-race-status-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}.year-race-status{display:grid;gap:4px;min-width:0;font-size:10px;font-weight:750;color:var(--muted)}.year-race-status select{width:100%;min-width:0;min-height:38px;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:11px}.year-race-more{margin-top:7px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.06)}.year-race-more>summary{padding:9px 11px;cursor:pointer;font-size:11px;font-weight:750;color:#FF6A00;list-style:none}.year-race-more>summary::-webkit-details-marker{display:none}.year-race-more>summary:after{content:'+';float:right;font-size:15px}.year-race-more[open]>summary:after{content:'−'}.year-race-more-content{padding:0 10px 10px}.year-race-more:focus-within{border-color:#FF6A00}@media(max-width:420px){.year-race-status-controls{grid-template-columns:1fr 1fr;gap:6px}.year-race-status select{font-size:10px;padding:5px}}.year-month-group>summary::-webkit-details-marker{display:none}.year-month-group>summary::after{content:"+";font-size:17px;color:#FF6A00;line-height:1}.year-month-group[open]>summary::after{content:"−"}.year-month-title{min-width:0}.year-month-count{flex:none;color:var(--muted);font-size:11px;font-weight:600}.year-month-races{padding:0 12px 10px}.year-month-races .year-race:first-child{border-top:1px solid var(--line)}.year-month-group>summary:focus-visible{outline:2px solid #7FD8FF;outline-offset:-3px;border-radius:10px}@media(prefers-reduced-motion:no-preference){.year-month-group .year-month-races{animation:yearMonthReveal .16s ease-out}@keyframes yearMonthReveal{from{opacity:.6;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}}
/* Alpine Performance v102 – stronger hierarchy for the yearly season timeline */
.year-month-nav{position:relative;gap:7px;padding:4px 2px 10px;margin:10px 0 4px;scroll-padding-inline:12px}
.year-month-chip{min-height:36px;padding:7px 12px;border-color:color-mix(in srgb,var(--line) 82%,#FF6A00);background:color-mix(in srgb,var(--card) 92%,transparent);font-size:11px;letter-spacing:.01em;transition:background .16s ease,border-color .16s ease,color .16s ease}
.year-month-chip.is-active{border-color:#FF6A00;background:linear-gradient(145deg,color-mix(in srgb,#FF6A00 24%,var(--card)),var(--card));color:var(--ink);box-shadow:0 3px 10px rgba(0,0,0,.08)}
.year-month-group{border-radius:14px;background:color-mix(in srgb,var(--card) 94%,transparent);transition:border-color .16s ease,box-shadow .16s ease}
.year-month-group>summary{min-height:48px;padding:13px 14px;font-size:13px;letter-spacing:-.01em}
.year-month-group[open]>summary{background:color-mix(in srgb,#FF6A00 8%,transparent)}
.year-month-count{padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-variant-numeric:tabular-nums}
.year-month-races{padding:5px 10px 11px}
.year-month-races .year-race:first-child{border-top:0}
.year-month-races .year-race{margin:7px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);box-shadow:0 3px 12px rgba(0,0,0,.045)}
.year-month-races .year-race:last-child{border-bottom:1px solid var(--line)}
.year-month-races .year-race-head>strong{font-size:14px;line-height:1.35}
.year-month-races .year-race-meta{margin:5px 0 8px;line-height:1.45}
.year-month-races .year-race-status-controls{gap:7px;margin:8px 0}
.year-month-races .year-race-status select{min-height:40px;border-radius:10px}
.year-month-races .year-race-more{margin-top:8px;background:color-mix(in srgb,var(--bg) 78%,transparent)}
.year-month-races .year-race-more[open]{border-color:color-mix(in srgb,#FF6A00 55%,var(--line))}
.year-month-races .year-race-more>summary{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.year-month-races .year-race-more>summary:after{margin-left:auto}
.year-month-chip:focus-visible,.year-month-group>summary:focus-visible{outline:3px solid #7FD8FF;outline-offset:2px}
@media(max-width:420px){.year-month-races{padding-inline:7px}.year-month-races .year-race{padding:10px}.year-month-group>summary{padding:11px 12px}.year-month-chip{padding-inline:10px}}
@media(prefers-reduced-motion:reduce){.year-month-chip,.year-month-group{transition:none}}`;
 document.head.appendChild(style);
}


/* Alpine Performance v103 – distinguish planned and completed races at a glance. */
const seasonStatusCss=document.createElement('style');
seasonStatusCss.id='season-status-visual-v103';
seasonStatusCss.textContent=`
#seasonRaceCards .season-race{display:grid;gap:11px;padding:14px;border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--card) 96%,#FF6A00 4%),var(--card));box-shadow:0 4px 14px rgba(0,0,0,.07)}
#seasonRaceCards .season-race-head{align-items:flex-start}
#seasonRaceCards .season-race-head>div>strong{display:block;font-size:14px;line-height:1.3;letter-spacing:-.015em}
#seasonRaceCards .season-race-head>div>.plan-meta{margin:5px 0 0;font-size:11px;line-height:1.45}
#seasonRaceCards .season-race-head>label{display:grid;gap:5px;min-width:145px;font-size:10px;font-weight:750;color:var(--muted)}
#seasonRaceCards .season-priority{width:100%;min-height:40px;border-radius:10px;background:var(--bg);color:var(--ink);border-color:var(--line)}
#seasonRaceCards .season-recovery{gap:8px;margin-top:0}
#seasonRaceCards .season-recovery label{display:grid;align-content:start;gap:5px;padding:9px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--bg) 70%,transparent);font-size:10px;line-height:1.35}
#seasonRaceCards .season-recovery input{min-height:38px;margin:0;padding:7px 8px;border-radius:8px;background:var(--card);font-size:12px}
#seasonRaceCards .season-recovery label:last-child input{font-weight:800;color:#FF6A00;border-color:color-mix(in srgb,#FF6A00 45%,var(--line))}
#seasonRaceCards .season-state-line{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0;padding-top:9px;border-top:1px solid var(--line);font-size:11px;line-height:1.45}
#seasonRaceCards .season-state-pill{display:inline-flex;align-items:center;gap:5px;min-height:27px;padding:4px 9px;border:1px solid;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.01em}
#seasonRaceCards .season-state-pill.is-completed{color:#BFEAFF;background:#18232D;border-color:#40586B}
#seasonRaceCards .season-state-pill.is-planned{color:#c7d7ef;background:#1c3047;border-color:#405e80}
#seasonTimeline .season-priority-review{border-radius:14px;padding:14px;background:var(--card)}
#seasonTimeline .season-year{padding:13px;border-radius:14px;background:color-mix(in srgb,var(--card) 88%,transparent)}
#seasonTimeline .season-year h4{display:flex;align-items:center;gap:8px;font-size:14px}
#seasonTimeline .season-lane{gap:8px;padding:8px 2px 12px;scroll-snap-type:x proximity;scroll-padding-inline:8px}
#seasonTimeline .season-block{flex:var(--season-days,1) 0 118px;min-height:104px;padding:11px;border:1px solid var(--line);border-top:4px solid #7FD8FF;border-radius:12px;background:linear-gradient(155deg,#18232D,#151D25);scroll-snap-align:start;box-shadow:0 3px 10px rgba(0,0,0,.06)}
#seasonTimeline .season-block strong{font-size:12px;line-height:1.35}
#seasonTimeline .season-block.a{border-top-color:#FF6A00}#seasonTimeline .season-block.b{border-top-color:#7FD8FF}#seasonTimeline .season-block.c{border-top-color:#8997A5}
#seasonTimeline .season-phase{font-size:10px;line-height:1.4}
@media(max-width:520px){#seasonRaceCards .season-race{padding:11px}#seasonRaceCards .season-race-head>label{width:100%;min-width:0}#seasonRaceCards .season-recovery{grid-template-columns:repeat(2,minmax(0,1fr))}#seasonRaceCards .season-recovery label:last-child{grid-column:1/-1}#seasonTimeline .season-lane{margin-inline:-3px;padding-inline:3px}#seasonTimeline .season-block{flex-basis:126px}}
@media(prefers-reduced-motion:reduce){#seasonTimeline .season-lane{scroll-behavior:auto}}
`;
document.head.querySelector('#season-status-visual-v103')?.remove();
document.head.appendChild(seasonStatusCss);
const originalSeasonStatusRender=window.renderSeasonEnhancements;
if(typeof originalSeasonStatusRender==='function'){
 const decorateSeasonStatus=()=>{
  document.querySelectorAll('#seasonRaceCards .season-race').forEach(article=>{
   const line=article.querySelector('.plan-meta:last-of-type');if(!line||line.dataset.statusDecorated==='1')return;
   const originalText=line.textContent||'';
   const completed=originalText.startsWith('Als gelaufen markiert');
   const planned=originalText.startsWith('Noch nicht als gelaufen markiert');
   if(!completed&&!planned)return;
   const prefix=completed?'Als gelaufen markiert':'Noch nicht als gelaufen markiert';
   const remainder=originalText.slice(prefix.length).replace(/^\\s*·?\\s*/,'');
   line.textContent='';
   line.classList.add('season-state-line');
   const pill=document.createElement('span');pill.className='season-state-pill '+(completed?'is-completed':'is-planned');pill.textContent=completed?'✓ Absolviert':'○ Geplant';
   line.appendChild(pill);
   if(remainder)line.appendChild(document.createTextNode(' · '+remainder));
   line.dataset.statusDecorated='1';
  });
 };
 window.renderSeasonEnhancements=function(){originalSeasonStatusRender();decorateSeasonStatus();};
 window.renderSeasonEnhancements();
}

  // Load the additive universal activity model without coupling it to legacy Trail data.
  if (!window.SportYear && !document.querySelector('script[data-sport-year-core]')) {
    const sportYearScript = document.createElement('script');
    sportYearScript.src = './sport-year.js';
    sportYearScript.defer = true;
    sportYearScript.dataset.sportYearCore = '1';
    document.head.appendChild(sportYearScript);
  }


/* Read imported Strava activities separately from completed race records. */
let stravaCockpitUser=null,stravaCockpitRows=null,stravaCockpitRequest=null;
function stravaWeekStart(date){const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function stravaMetric(rows){return rows.reduce((v,a)=>({km:v.km+(Number(a.distance_m)||0)/1000,hm:v.hm+(Number(a.total_elevation_gain_m)||0),seconds:v.seconds+(Number(a.moving_time_seconds)||0),count:v.count+1}),{km:0,hm:0,seconds:0,count:0});}
function stravaCockpitPanel(rows,message){
 const root=document.getElementById('seasonCockpit');if(!root)return;
 root.querySelector('#strava-cockpit-panel')?.remove();
 const box=document.createElement('section');box.id='strava-cockpit-panel';box.className='season-training-panel';
 if(!rows){box.innerHTML='<div class="season-training-heading"><div><span class="nb-eyebrow">NORTHBOUND · TRAINING</span><h3>Dein Training aus Strava</h3><p>'+escText(message||'Trainingsaktivitäten werden geladen …')+'</p></div></div>';root.appendChild(box);return;}
 const now=new Date(),week=stravaWeekStart(now),prev=new Date(week);prev.setDate(prev.getDate()-7);
 const currentRows=rows.filter(a=>a.started_at&&new Date(a.started_at)>=week),previousRows=rows.filter(a=>a.started_at&&new Date(a.started_at)>=prev&&new Date(a.started_at)<week);
 const current=stravaMetric(currentRows),previous=stravaMetric(previousRows);
 const fmt=n=>Number(n||0).toLocaleString('de-DE',{maximumFractionDigits:1});
 const hours=n=>((n||0)/3600).toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
 const types={};
 currentRows.forEach(a=>{const raw=String(a.sport_type||'Other').toLowerCase();let label=/run|trail|hike|walk/.test(raw)?'Run & Trail':/ride|bike|cycling/.test(raw)?'Bike':/yoga/.test(raw)?'Yoga':raw==='other'?'Weitere':String(a.sport_type||'Weitere');types[label]=(types[label]||0)+1;});
 const typeHtml=Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([label,count])=>'<span class="strava-sport-chip">'+escText(label)+' <b>'+count+'</b></span>').join('')||'<span class="plan-meta">Noch keine Aktivitäten in dieser Woche</span>';
 const stat=(value,label)=>'<div class="season-kpi"><strong>'+value+'</strong><span>'+label+'</span></div>';
 box.innerHTML='<div class="season-training-heading"><div><span class="nb-eyebrow">NORTHBOUND · TRAINING</span><h3>Deine Strava-Woche</h3><p>Importierte Trainingsaktivitäten – unabhängig von deinen Wettkampfergebnissen.</p></div><span class="season-training-period">AKTUELLE WOCHE</span></div><div class="season-dashboard-stats">'+stat(fmt(current.km)+' km','Distanz')+stat(Math.round(current.hm).toLocaleString('de-DE')+' hm','Höhenmeter')+stat(current.count,'Aktivitäten')+stat(hours(current.seconds),'Bewegungszeit')+'</div><div class="strava-sport-breakdown"><strong>Sportarten diese Woche</strong><div>'+typeHtml+'</div></div><p class="season-training-note">Vorwoche: '+fmt(previous.km)+' km · '+Math.round(previous.hm).toLocaleString('de-DE')+' hm · '+previous.count+' Aktivitäten · '+hours(previous.seconds)+'. Grundlage: '+rows.length+' importierte Strava-Aktivitäten der letzten 90 Tage.</p></div>';
 root.appendChild(box);
}
async function loadStravaCockpit(){
 const root=document.getElementById('seasonCockpit');if(!root)return;
 const user=typeof cloudUser!=='undefined'&&cloudUser?cloudUser.id:null;
 if(!user||typeof cloudClient==='undefined'||!cloudClient){stravaCockpitPanel(null,'Bitte anmelden und Strava im Bereich Training verbinden.');return;}
 if(stravaCockpitUser!==user){stravaCockpitUser=user;stravaCockpitRows=null;stravaCockpitRequest=null;}
 if(stravaCockpitRows){stravaCockpitPanel(stravaCockpitRows);return;}
 stravaCockpitPanel(null,'Importierte Aktivitäten werden abgerufen …');
 if(stravaCockpitRequest)return;
 const start=new Date();start.setDate(start.getDate()-90);
 stravaCockpitRequest=(async()=>{
  const {data,error}=await cloudClient.from('strava_activities').select('provider_activity_id,name,sport_type,started_at,distance_m,moving_time_seconds,total_elevation_gain_m').gte('started_at',start.toISOString()).order('started_at',{ascending:false}).limit(1000);
  if(error)throw error;
  stravaCockpitRows=Array.isArray(data)?data:[];
  stravaCockpitPanel(stravaCockpitRows);
 })().catch(()=>{stravaCockpitPanel(null,'Strava-Daten konnten nicht geladen werden. Bitte Verbindung und Synchronisation im Bereich Training prüfen.');}).finally(()=>{stravaCockpitRequest=null;});
 await stravaCockpitRequest;
}
const stravaCockpitStyle=document.createElement('style');
stravaCockpitStyle.textContent='#strava-cockpit-panel .season-dashboard-stats{margin-top:12px}#strava-cockpit-panel .season-kpi{min-width:0}#strava-cockpit-panel .season-kpi strong{font-size:19px}#strava-cockpit-panel .strava-sport-breakdown{margin-top:13px}#strava-cockpit-panel .strava-sport-breakdown>strong{font-size:12px}#strava-cockpit-panel .strava-sport-breakdown>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.strava-sport-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-size:11px}.strava-sport-chip b{color:#FF6A00}';
stravaCockpitStyle.id='strava-cockpit-style';document.head.querySelector('#strava-cockpit-style')?.remove();document.head.appendChild(stravaCockpitStyle);
const originalStravaCockpitRender=window.renderSeasonCockpit;
if(typeof originalStravaCockpitRender==='function'){
 window.renderSeasonCockpit=function(){originalStravaCockpitRender();loadStravaCockpit();};
 window.renderSeasonCockpit();
}

})();
