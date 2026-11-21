(()=>{'use strict';
const groups={'Pflichtausrüstung':['Pflichtausrüstung laut Veranstalter geprüft','Stirnlampe und Ersatzlicht','Notfallausrüstung / Erste Hilfe','Wetter- und Kälteschutz'],'Persönliche Ausrüstung':['Schuhe und Socken','Rucksack / Laufweste','Stöcke','Uhr und Navigation'],'Verpflegung':['Gels / Riegel / feste Nahrung','Elektrolyte und Salz','Flaschen / Softflasks','Verpflegung für Dropbags'],'Reise & Unterkunft':['Anreise organisiert','Unterkunft gebucht','Startnummernausgabe geprüft','Rückreise organisiert'],'Anmeldung':['Anmeldung bestätigt','Startgebühr bezahlt','Versicherung / Lizenz geprüft']};
function key(id,ri){return routeKey(id,ri);}
function data(id,ri){return eventDataEdits[key(id,ri)]||{};}
function save(id,ri,patch){const k=key(id,ri),all={...eventDataEdits,[k]:{...(eventDataEdits[k]||{}),...patch}},raw=JSON.stringify(all);try{localStorage.setItem('trailEventDataEdits',raw);if(localStorage.getItem('trailEventDataEdits')!==raw)throw Error('Speichern nicht bestätigt');eventDataEdits=all;queuePlannerCloudSave();return true;}catch(e){alert('Rennplanung konnte nicht gespeichert werden: '+e.message);return false;}}
function estimate(r,d){const pace=Number(d.pace),pause=Math.max(0,Number(d.pause)||0),km=Number(r.km);if(!(pace>0&&km>0))return 'Zieltempo und Streckendistanz eingeben, um die geschätzte Zielzeit zu berechnen.';const moving=pace*km,total=moving+pause,hours=total/60,cutoff=Number(r.maxh),fuel=Math.max(15,Number(d.fuel)||60),stops=Math.max(0,Math.floor(total/fuel)),start=d.start||r.starttime||'',finish=start?(()=>{const [h,m]=start.split(':').map(Number),mins=(h*60+m+Math.round(total))%1440;return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');})():'',cutoffText=cutoff>0?(hours<=cutoff?' <span class="race-cutoff-ok">✓ innerhalb der angegebenen Maximalzeit von '+cutoff+' h</span>':' <span class="race-cutoff-warning">⚠ Überschreitung der angegebenen Maximalzeit von '+cutoff+' h um '+(hours-cutoff).toFixed(1)+' h</span>'):' Maximalzeit nicht hinterlegt.';return 'Geschätzte Gesamtzeit: <b>'+Math.floor(total/60)+' h '+String(Math.round(total%60)).padStart(2,'0')+' min</b> (Laufzeit '+Math.round(moving)+' min + Pausen '+pause+' min).'+(finish?' Voraussichtliches Ziel: <b>'+finish+'</b>.':'')+cutoffText+'<br>Verpflegungs-Erinnerungen: etwa '+stops+' bei einem Intervall von '+fuel+' Minuten. Individuelle Verträglichkeit und Veranstaltervorgaben beachten.';}
function strategy(id,ri,r){const d=data(id,ri).raceStrategy||{},p=typeof seasonPriorities!=='undefined'?(seasonPriorities[key(id,ri)]||'B'):'B',event=EVENTS[id],raceDate=typeof plannerRouteDate==='function'?plannerRouteDate(event,ri):null,days=raceDate instanceof Date&&!Number.isNaN(raceDate.getTime())?Math.ceil((raceDate-new Date())/86400000):null,context='<div class="race-season-context"><b>Saisonpriorität: '+p+'-Rennen'+'</b>'+(days===null?' · Renndatum offen':days>0?' · Noch '+days+' Tage bis zum Start':days===0?' · Start heute':' · Rennen bereits vorbei')+'</div>';return '<section class="race-tools-section"><h4>🧭 Rennstrategie</h4>'+context+'<div class="edit-grid"><label>Zieltempo (min/km)<input id="rtP'+id+'_'+ri+'" type="number" min="1" max="60" step=".1" value="'+esc(d.pace||'')+'" placeholder="8.5"></label><label>Pausen gesamt (Min.)<input id="rtB'+id+'_'+ri+'" type="number" min="0" max="1440" value="'+esc(d.pause||'')+'" placeholder="45"></label><label>Verpflegung alle (Min.)<input id="rtF'+id+'_'+ri+'" type="number" min="15" max="240" step="5" value="'+esc(d.fuel||60)+'"></label><label>Startzeit<input id="rtS'+id+'_'+ri+'" type="time" value="'+esc(d.start||r.starttime||'')+'"></label></div><label>Notizen<textarea id="rtN'+id+'_'+ri+'" rows="2">'+esc(d.notes||'')+'</textarea></label><button class="secondary" type="button" id="rtSave'+id+'_'+ri+'">Strategie speichern</button><p id="rtOut'+id+'_'+ri+'">'+estimate(r,d)+'</p><small>Nur eine grobe Planungshilfe. Offizielle Cut-offs separat prüfen.</small></section>';}
function checklist(id,ri){const d=data(id,ri).raceChecklist||{},all=Object.values(groups).flat().length,done=Object.keys(d).filter(k=>d[k]===true).length;return '<section class="race-tools-section"><h4>☑️ Renn-Checkliste</h4><div class="race-check-progress"><b id="raceCheckCount'+id+'_'+ri+'">'+done+' / '+all+' erledigt</b><div class="race-check-track"><i id="raceCheckBar'+id+'_'+ri+'" style="width:'+Math.round(done/all*100)+'%"></i></div></div>'+Object.entries(groups).map(([g,items])=>{const groupDone=items.filter((v,i)=>d[g+'_'+i]===true).length;return '<div class="checklist-group"><b>'+g+' · '+groupDone+'/'+items.length+'</b>'+items.map((v,i)=>{const k=g+'_'+i;return '<label><input type="checkbox" data-check="'+k+'" '+(d[k]?'checked':'')+'> '+v+'</label>';}).join('')+'</div>';}).join('')+'</section>';}
function training(){const rows=[];Object.values(runAttempts||{}).forEach(list=>(Array.isArray(list)?list:[]).forEach(x=>{const date=new Date((x.date||'')+'T12:00:00');if(Number.isFinite(date.getTime()))rows.push({date,km:Number(x.actualKm)||0,hm:Number(x.actualHm)||0,h:Number(x.hours||0)+Number(x.minutes||0)/60});}));const now=new Date(),weeks=Array.from({length:12},(_,i)=>{const end=new Date(now);end.setHours(23,59,59,999);end.setDate(end.getDate()-(11-i)*7);const start=new Date(end);start.setDate(start.getDate()-6);const a=rows.filter(x=>x.date>=start&&x.date<=end);return {km:a.reduce((n,x)=>n+x.km,0),hm:a.reduce((n,x)=>n+x.hm,0),h:a.reduce((n,x)=>n+x.h,0),label:'Woche '+(i+1)};});const max=Math.max(1,...weeks.map(x=>x.km));return '<section class="race-tools-section"><h4>📈 Trainingshistorie – letzte 12 Wochen</h4><p class="plan-meta">Nur gespeicherte Laufhistorieneinträge, keine erfundenen Trainingswerte.</p>'+weeks.map(x=>'<div class="training-week"><span>'+x.label+'</span><div class="training-bar-track"><div class="training-bar" style="width:'+x.km/max*100+'%"></div></div><b>'+x.km.toFixed(1)+' km</b><small>'+Math.round(x.hm)+' hm · '+x.h.toFixed(1)+' h</small></div>').join('')+'</section>';}
function segments(r,id,ri){const p=r.elevationProfile||r.profilePoints||[],km=Number(r.km)||Number(r.distanceKm)||0;if(!Array.isArray(p)||p.length<2||!km)return '<p class="plan-meta">Für die Abschnittsanalyse bitte ein GPX-Höhenprofil hinterlegen.</p>';const step=Number(data(id,ri).segmentDistance)||10,out=[];for(let a=0;a<km;a+=step){const b=Math.min(km,a+step),v=p.filter(q=>Number(Array.isArray(q)?q[0]:q.km??q.distance??q.x)>=a&&Number(Array.isArray(q)?q[0]:q.km??q.distance??q.x)<=b).map(q=>Number(Array.isArray(q)?q[1]:q.hm??q.elevation??q.y)).filter(Number.isFinite);let up=0;for(let i=1;i<v.length;i++)if(v[i]>v[i-1])up+=v[i]-v[i-1];out.push('<div class="segment-row"><span>'+a+'–'+b+' km</span><b>+'+Math.round(up)+' hm</b><span>Abschnitt</span></div>');}return '<div class="segment-table"><div class="segment-row segment-head"><b>Abschnitt</b><b>Aufstieg</b><b>Info</b></div>'+out.join('')+'</div>';}
function segmentUi(id,ri,r){return '<section class="race-tools-section"><h4>🗺️ Höhenprofil-Abschnitte</h4><label>Abschnittslänge (km)<input id="rsD'+id+'_'+ri+'" type="number" min="1" max="50" value="'+(data(id,ri).segmentDistance||10)+'"></label><div id="rsO'+id+'_'+ri+'">'+segments(r,id,ri)+'</div></section>';}
const css=document.createElement('style');css.textContent='.race-tools-section{margin:14px 0;padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--card)}.race-tools-section h4{margin:0 0 8px}.race-tools-section textarea{width:100%;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}.checklist-group{margin:9px 0;padding:9px;border:1px solid var(--line);border-radius:9px}.checklist-group label{display:flex;gap:8px;margin:7px 0;font-size:13px}.checklist-group input{width:18px;height:18px}.training-week{display:grid;grid-template-columns:65px 1fr 65px;gap:6px;align-items:center;font-size:11px;margin:7px 0}.training-week small{grid-column:2/-1}.training-bar-track{height:8px;background:var(--line);border-radius:8px;overflow:hidden}.training-bar{height:100%;background:#4e9a6d}.race-season-context{padding:8px 10px;margin:7px 0 11px;border-radius:9px;background:var(--bg);font-size:12px;color:var(--muted)}.race-season-context b{color:var(--green)}.race-check-progress{margin:8px 0 12px}.race-check-track{height:8px;background:var(--line);border-radius:8px;overflow:hidden;margin-top:6px}.race-check-track i{display:block;height:100%;background:var(--green);transition:width .2s}.race-cutoff-ok{color:var(--green);font-weight:700}.race-cutoff-warning{color:#a65d18;font-weight:700}.segment-row{display:grid;grid-template-columns:1fr .7fr 1fr;gap:8px;padding:7px;border-bottom:1px solid var(--line);font-size:12px}';document.head.appendChild(css);
const original=window.showPlannedEventDetails;if(typeof original!=='function')return;
window.showPlannedEventDetails=function(id,ri){original(id,ri);const root=document.getElementById('plannedEventDetailContent'),r=EVENTS[id]?.routes?.[ri];if(!root||!r)return;const wrap=document.createElement('div');wrap.innerHTML='<h4>Persönliche Rennvorbereitung</h4>'+strategy(id,ri,r)+checklist(id,ri)+training()+segmentUi(id,ri,r);root.appendChild(wrap);
const saveBtn=document.getElementById('rtSave'+id+'_'+ri);saveBtn?.addEventListener('click',()=>{const val=n=>document.getElementById(n+id+'_'+ri)?.value||'',pace=val('rtP');if(pace&&(!(Number(pace)>0)||Number(pace)>60)){alert('Bitte ein plausibles Zieltempo eintragen.');return;}const d={pace,pause:val('rtB'),fuel:val('rtF'),start:val('rtS'),notes:val('rtN')};if(save(id,ri,{raceStrategy:d}))document.getElementById('rtOut'+id+'_'+ri).innerHTML=estimate(r,d);});
wrap.querySelectorAll('[data-check]').forEach(input=>input.addEventListener('change',()=>{const d={...(data(id,ri).raceChecklist||{}),[input.dataset.check]:input.checked};if(!save(id,ri,{raceChecklist:d}))return;const all=wrap.querySelectorAll('[data-check]').length,done=[...wrap.querySelectorAll('[data-check]')].filter(x=>x.checked).length,count=document.getElementById('raceCheckCount'+id+'_'+ri),bar=document.getElementById('raceCheckBar'+id+'_'+ri);if(count)count.textContent=done+' / '+all+' erledigt';if(bar)bar.style.width=Math.round(done/all*100)+'%';const group=input.closest('.checklist-group');if(group){const checks=[...group.querySelectorAll('[data-check]')],n=checks.filter(x=>x.checked).length,b=group.querySelector('b');if(b)b.textContent=b.textContent.replace(/· \d+\/\d+$/, '· '+n+'/'+checks.length);}}));
const dist=document.getElementById('rsD'+id+'_'+ri);dist?.addEventListener('change',()=>{const n=Math.max(1,Math.min(50,Number(dist.value)||10));save(id,ri,{segmentDistance:n});document.getElementById('rsO'+id+'_'+ri).innerHTML=segments(r,id,ri);});
};
})();

// Erweiterung: konkrete Verpflegungszeiten und streckenbasierte Cut-off-Prognose
(()=>{'use strict';
const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const pad=v=>String(v).padStart(2,'0');
const clock=(start,mins)=>{if(!start)return '–';const m=/^(\d{1,2}):(\d{2})$/.exec(start);if(!m)return '–';const t=(Number(m[1])*60+Number(m[2])+Math.round(mins))%1440;return pad(Math.floor(t/60))+':'+pad(t%60);};
function profileOf(r){const p=r.elevationProfile||r.profilePoints||[];return Array.isArray(p)?p.map(q=>({km:n(Array.isArray(q)?q[0]:q.km??q.distance??q.x),el:n(Array.isArray(q)?q[1]:q.elevation??q.hm??q.y)})).filter(q=>Number.isFinite(q.km)&&Number.isFinite(q.el)).sort((a,b)=>a.km-b.km):[];}
function elevationAt(p,km){if(!p.length)return null;if(km<=p[0].km)return p[0].el;if(km>=p[p.length-1].km)return p[p.length-1].el;for(let i=1;i<p.length;i++)if(p[i].km>=km){const a=p[i-1],b=p[i],f=(km-a.km)/(b.km-a.km||1);return a.el+(b.el-a.el)*f;}return null;}
function makeSections(r,d){const total=n(r.km),p=profileOf(r);if(!(total>0))return {sections:[],reason:'Für diese Strecke ist keine gültige Distanz hinterlegt.'};if(p.length<2)return {sections:[],reason:'Für die abschnittsbezogene Berechnung fehlt ein GPX- oder Höhenprofil mit mindestens zwei Höhenpunkten.'};
const cuts=Array.isArray(r.cutoffs)?r.cutoffs:[],step=Math.max(1,Math.min(20,n(d.planStep)||5)),marks=new Set([0,total]);for(let km=step;km<total;km+=step)marks.add(Number(km.toFixed(2)));cuts.forEach(c=>{const km=n(c.km);if(km>0&&km<total)marks.add(km);});const xs=[...marks].sort((a,b)=>a-b),base=n(d.pace),climb=Math.max(0,n(d.climbFactor??0.7)),down=Math.max(0,n(d.downFactor??0.15)),sections=[];
for(let i=1;i<xs.length;i++){const a=xs[i-1],b=xs[i],ea=elevationAt(p,a),eb=elevationAt(p,b);let up=0,downHm=0;for(let j=1;j<p.length;j++){const x=p[j-1],y=p[j];if(y.km<=a||x.km>=b)continue;const lo=Math.max(a,x.km),hi=Math.min(b,y.km),f=(hi-lo)/(y.km-x.km||1),delta=(y.el-x.el)*f;if(delta>0)up+=delta;else downHm+=-delta;}
const km=b-a,pace=base>0?Math.max(1,base+up/100*climb-downHm/100*down):0;sections.push({from:a,to:b,km,up,down:downHm,pace,minutes:pace*km});}
return {sections,reason:'',total};}
function renderPlan(id,ri,r){const data=window.racePlanData?.(id,ri)||{},d=data.coursePlan||{},p=profileOf(r),cuts=Array.isArray(r.cutoffs)?r.cutoffs:[],hasProfile=p.length>=2,hasCutoffs=cuts.length>0;
const pace=d.pace??data.raceStrategy?.pace??'',fuel=d.fuel??data.raceStrategy?.fuel??45,start=d.start??data.raceStrategy?.start??r.starttime??'';
const type=d.fuelType||'Gel',drink=d.drink||'Wasser + Elektrolyte',interval=Math.max(15,Math.min(240,n(fuel)||45));
const aidStatus=r.aidStationsStatus?'<p class="plan-meta"><strong>Stand Verpflegung:</strong> '+escHtml(r.aidStationsStatus)+(r.aidStationCount?' ('+n(r.aidStationCount)+' Stationen)':'')+'</p>':'';
return '<section class="race-tools-section" id="coursePlan'+id+'_'+ri+'"><h4>🥤 Rennverpflegung & Cut-off-Fahrplan</h4><p class="plan-meta">Berechnung anhand der hinterlegten Streckenabschnitte. Offizielle Kontrollzeiten bleiben maßgeblich; Prognosen sind keine Veranstalterangaben.</p><div class="edit-grid"><label>Grundtempo (min/km)<input type="number" min="1" max="60" step=".1" data-cp="pace" value="'+escHtml(pace)+'" placeholder="z. B. 8.5"></label><label>Verpflegung alle (Min.)<input type="number" min="15" max="240" step="5" data-cp="fuel" value="'+interval+'"></label><label>Startzeit<input type="time" data-cp="start" value="'+escHtml(start)+'"></label><label>Planungsabschnitte (km)<input type="number" min="1" max="20" step="1" data-cp="planStep" value="'+(n(d.planStep)||5)+'"></label><label>Zusatzzeit je 100 hm Aufstieg (Min.)<input type="number" min="0" max="5" step=".1" data-cp="climbFactor" value="'+(d.climbFactor??0.7)+'"></label><label>Abzug je 100 hm Abstieg (Min.)<input type="number" min="0" max="3" step=".05" data-cp="downFactor" value="'+(d.downFactor??0.15)+'"></label><label>Verpflegung<input data-cp="fuelType" value="'+escHtml(type)+'" placeholder="Gel, Riegel …"></label><label>Getränk<input data-cp="drink" value="'+escHtml(drink)+'" placeholder="Wasser, Elektrolyte …"></label></div><h5>Verpflegungsstationen</h5>'+aidStatus+'<p class="plan-meta">Je Zeile: Stationsname | Streckenkilometer | Nahrung | Getränke. Unsichere Angaben werden als vorläufig gekennzeichnet. Die Quellenadresse wird mitgespeichert.</p><label>Stationen<textarea data-cp-stations rows="5" placeholder="Beispiel: Almhütte | 18.5 | Wasser, Banane | Wasser, Iso"></textarea></label><label>Offizielle Quellenadresse<input type="url" data-cp-station-source placeholder="https://veranstalter.example/versorgung"></label><button class="secondary" type="button" data-cp-save>Fahrplan speichern & berechnen</button><div class="planner-status" data-cp-status>Änderungen eingeben und berechnen.</div><div data-cp-output></div></section>';}
function calculate(root,id,ri,r){const fields={};root.querySelectorAll('[data-cp]').forEach(el=>fields[el.dataset.cp]=el.value);const d={...fields};if(!(n(d.pace)>0&&n(d.pace)<=60)){root.querySelector('[data-cp-status]').textContent='Bitte ein plausibles Grundtempo zwischen 1 und 60 min/km eintragen.';return;}
const stationText=root.querySelector('[data-cp-stations]')?.value||'',stationSource=root.querySelector('[data-cp-station-source]')?.value||'';
let stations=stationText.split(/\r?\n/).map(line=>line.split('|').map(x=>x.trim())).filter(parts=>parts.length>=2&&parts[0]&&Number.isFinite(Number(parts[1]))&&Number(parts[1])>=0&&Number(parts[1])<=n(r.km)).map(parts=>{const known=[...(r.aidStations||[]),...(window.racePlanData?.(id,ri)?.aidStations||[])].find(x=>x.name===parts[0]&&Number(x.km)===Number(parts[1]));return {name:parts[0],km:Number(parts[1]),food:parts[2]||'',drink:parts[3]||'',source:stationSource,cutoffTime:known?.cutoffTime||'',verified:!!known?.verified,crewAllowed:!!known?.crewAllowed,approximate:!!known?.approximate};});
if(!stations.length&&r.aidStationIntervals){const a=r.aidStationIntervals,limit=n(r.km),byKm=new Map();for(let km=n(a.waterEveryKm);km>0&&km<limit;km+=n(a.waterEveryKm)){byKm.set(km,{name:'Wasserstation ca.',km,food:'',drink:a.water,approximate:true});}for(let km=n(a.foodEveryKm);km>0&&km<limit;km+=n(a.foodEveryKm)){const old=byKm.get(km)||{name:'Versorgungsstation ca.',km,food:'',drink:'',approximate:true};old.name='Wasser- und Versorgungsstation ca.';old.food=a.food;old.drink=a.water;old.approximate=true;byKm.set(km,old);}stations=[...byKm.values()];}
if(stationText.trim()&&stations.length!==stationText.trim().split(/\r?\n/).filter(x=>x.trim()).length){root.querySelector('[data-cp-status]').textContent='Mindestens eine Stationszeile ist ungültig. Format: Name | km | Nahrung | Getränke. Kilometer müssen innerhalb der Strecke liegen.';return;}
if(window.saveRacePlanData&&!window.saveRacePlanData(id,ri,{coursePlan:d,aidStations:stations,aidStationsSource:stationSource})){root.querySelector('[data-cp-status]').textContent='Speichern fehlgeschlagen. Bitte Speicherplatz und Cloudstatus prüfen.';return;}
const result=makeSections(r,d);if(result.reason){root.querySelector('[data-cp-status]').textContent=result.reason;return;}
const sections=result.sections,totalKm=result.total,totalMinutes=sections.reduce((a,s)=>a+s.minutes,0),cutoffs=Array.isArray(r.cutoffs)?r.cutoffs:[],aidPause=Math.max(0,n(d.pauseAtStops)||0);
const schedule=[];for(let t=n(d.fuel);t>0&&t<totalMinutes;t+=Math.max(15,n(d.fuel))){let elapsed=0,km=0;for(const s of sections){if(elapsed+s.minutes>=t){km=s.from+(s.km*((t-elapsed)/(s.minutes||1)));break;}elapsed+=s.minutes;km=s.to;}schedule.push({t,km});}
stations.forEach(st=>{let elapsed=0;for(const sec of sections){if(sec.to<=st.km+0.001)elapsed+=sec.minutes;else if(sec.from<st.km){elapsed+=sec.minutes*((st.km-sec.from)/(sec.km||1));break;}}schedule.push({t:elapsed,km:st.km,station:st});});schedule.sort((a,b)=>a.t-b.t);
const start=d.start||'',food=schedule.map(x=>'<tr><td>'+clock(start,x.t)+'</td><td>'+x.km.toFixed(1)+' km'+(x.station?' · '+escHtml(x.station.name)+(x.station.cutoffTime?' · Cut-off '+escHtml(x.station.cutoffTime):''):'')+'</td><td>'+escHtml(x.station?(x.station.food||'Eigene Nahrung mitführen'):(d.fuelType||'Gel'))+'</td><td>'+escHtml(x.station?(x.station.drink||'Keine Getränkeangabe'):(d.drink||'Wasser + Elektrolyte'))+'</td></tr>').join('');
const stationRows=stations.slice().sort((a,b)=>a.km-b.km).map(st=>{let elapsed=0;for(const sec of sections){if(sec.to<=st.km+0.001)elapsed+=sec.minutes;else if(sec.from<st.km)elapsed+=sec.minutes*((st.km-sec.from)/(sec.km||1));}const official=!!stationSource;return '<tr><td>'+escHtml(st.name)+'</td><td>'+st.km.toFixed(1)+' km</td><td>'+clock(start,elapsed)+'</td><td>'+escHtml(st.food||'–')+'</td><td>'+escHtml(st.drink||'–')+'</td><td>'+(st.cutoffTime?'Cut-off '+escHtml(st.cutoffTime):'–')+'</td><td>'+(st.approximate?'Ungefähre Veranstalter-Intervalle':st.verified?'Offizielle Angabe · Quelle hinterlegt':official?'Quelle hinterlegt · nicht automatisch geprüft':'Nicht verifiziert')+(st.crewAllowed?' · Crew-Zugang':'')+'</td></tr>';}).join('');
const rows=sections.map(s=>{const elapsed=sections.filter(x=>x.to<=s.to).reduce((a,x)=>a+x.minutes,0);const cutoff=cuts.find(c=>Math.abs(n(c.km)-s.to)<0.15);let official=cutoff?.time||cutoff?.cutoff||'';let status='';if(official&&/^\d{1,2}:\d{2}$/.test(official)&&start){const [sh,sm]=start.split(':').map(Number),[ch,cm]=official.split(':').map(Number);let deadline=ch*60+cm-(sh*60+sm);if(deadline<0)deadline+=1440;status=elapsed<=deadline?'<span class="race-cutoff-ok">Prognose '+clock(start,elapsed)+' · Reserve '+Math.round(deadline-elapsed)+' min</span>':'<span class="race-cutoff-warning">Prognose '+clock(start,elapsed)+' · '+Math.round(elapsed-deadline)+' min zu spät</span>';}else if(cutoff)status='Offizieller Cut-off: '+escHtml(official||'Zeit nicht veröffentlicht')+' · Startzeit für Vergleich erforderlich';return '<tr><td>'+s.from.toFixed(1)+'–'+s.to.toFixed(1)+' km</td><td>'+Math.round(s.up)+' hm</td><td>'+s.minutes.toFixed(0)+' min</td><td>'+clock(start,elapsed)+'</td><td>'+(cutoff?escHtml(cutoff.name||cutoff.checkpoint||'Kontrollpunkt')+' · ':'')+status+'</td></tr>';}).join('');
const cutoffChecks=cuts.filter(c=>n(c.km)>0).map(c=>{let elapsed=0;for(const s of sections){if(s.to<=n(c.km)+0.01)elapsed+=s.minutes;else if(s.from<n(c.km))elapsed+=s.minutes*((n(c.km)-s.from)/(s.km||1));}return {c,elapsed};});
const cutoffHtml=cutoffChecks.length?'<h5>Offizielle Cut-off-Kontrollpunkte</h5><div class="table-scroll"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>Kontrollpunkt</th><th>km</th><th>Offiziell</th><th>Prognose</th></tr></thead><tbody>'+cutoffChecks.map(({c,elapsed})=>'<tr><td>'+escHtml(c.name||c.checkpoint||'Kontrollpunkt')+'</td><td>'+n(c.km).toFixed(1)+'</td><td>'+escHtml(c.time||c.cutoff||'Nicht veröffentlicht')+'</td><td>'+clock(start,elapsed)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="plan-meta">Keine offiziellen Zwischen-Cut-offs hinterlegt. Es wird kein Zeitlimit erfunden.</p>';
root.querySelector('[data-cp-status]').innerHTML='Geschätzte Zielzeit: <b>'+Math.floor(totalMinutes/60)+' h '+Math.round(totalMinutes%60)+' min</b> · '+totalKm.toFixed(1)+' km · Profilabschnitte berücksichtigt. '+(Number(r.maxh)>0?'Maximalzeit laut Datensatz: '+r.maxh+' h.':'Keine offizielle Maximalzeit hinterlegt.');
root.querySelector('[data-cp-output]').innerHTML='<h5>Verpflegungsstationen des Veranstalters</h5>'+(stationRows?'<div class="table-scroll"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>Station</th><th>km</th><th>Prognose</th><th>Nahrung</th><th>Getränke</th><th>Cut-off</th><th>Quellenstatus</th></tr></thead><tbody>'+stationRows+'</tbody></table></div>':'<p class="plan-meta">Für diese Strecke sind noch keine Veranstalter-Verpflegungsstationen eingetragen. Es werden keine Stationen erfunden.</p>')+(stationSource?'<p class="plan-meta">Quellenlink: <a href="'+escHtml(stationSource)+'" target="_blank" rel="noopener">Veranstalterangaben öffnen</a></p>':'')+'<h5>Verpflegung nach Zeit und Streckenposition</h5>'+(food?'<div class="table-scroll"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>Uhrzeit</th><th>Position</th><th>Nahrung</th><th>Getränk</th></tr></thead><tbody>'+food+'</tbody></table></div>':'<p class="plan-meta">Für diese geschätzte Rennzeit liegt kein weiterer Verpflegungstermin im gewählten Intervall.</p>')+'<h5>Streckenabschnitte & Zeitprognose</h5><div class="table-scroll"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>Abschnitt</th><th>Aufstieg</th><th>Zeit</th><th>Durchgang</th><th>Cut-off</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+cutoffHtml+'<p class="plan-meta">Hinweis: Das Modell verteilt ein gleichmäßiges Grundtempo und korrigiert es anhand der Höhenmeter. Technische Trails, Untergrund, Wetter, Ermüdung, Nachtpassagen und lange Verpflegungsstopps können deutlich abweichen. Nahrungsmenge und Kohlenhydratzufuhr bitte nach erprobter persönlicher Verträglichkeit einstellen.</p>';
}
const prior=window.showPlannedEventDetails;if(typeof prior!=='function')return;
window.showPlannedEventDetails=function(id,ri){prior(id,ri);const root=document.getElementById('plannedEventDetailContent'),r=EVENTS?.[id]?.routes?.[ri];if(!root||!r)return;const wrap=document.createElement('div');wrap.innerHTML=renderPlan(id,ri,r);root.appendChild(wrap);const panel=wrap.querySelector('[id^="coursePlan"]');const saved=window.racePlanData?.(id,ri)||{};const st=saved.aidStations||r.aidStations||[];panel.querySelector('[data-cp-stations]').value=st.map(x=>[x.name,x.km,x.food||'',x.drink||''].join(' | ')).join('\n');panel.querySelector('[data-cp-station-source]').value=saved.aidStationsSource||r.aidStationsSource||'';panel.querySelector('[data-cp-save]').addEventListener('click',()=>calculate(panel,id,ri,r));};
})();

// Bind the push setup directly to the button. Do not rely on an inline
// onclick attribute or a separate delegated handler: both made taps silently
// do nothing in the installed iOS app.
(()=>{
  const repair=()=>{
    const button=document.getElementById('enableReviewNotifications');
    if(!button || button.dataset.pushClickBound==='1') return;
    button.removeAttribute('onclick');
    button.addEventListener('click',async()=>{
      const out=document.getElementById('reviewNotificationStatus');
      if(out) out.textContent='Klick erkannt – Push-Einrichtung wird gestartet …';
      button.disabled=true;
      try{
        if(typeof window.registerReviewPush!=='function') throw new Error('Push-Einrichtung ist in dieser App-Version nicht geladen.');
        await window.registerReviewPush();
      }catch(error){
        if(out) out.textContent='Push-Einrichtung fehlgeschlagen: '+(error?.message||'Unbekannter Fehler');
      }finally{
        button.disabled=false;
      }
    });
    button.dataset.pushClickBound='1';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',repair,{once:true});
  else repair();
})();



/* Fail-closed GPX rights enforcement. This is deliberately separate from
   personal activity imports: only organiser course GPX is governed here. */
(function installGpxRightsGate(){
  const fallbackPolicy = {
    PROCESS_ACTIONS:["gpxFileFetch","gpxFileImport","gpxFileProcess","gpxFileStore","gpxFileMapDisplay"],
    defaultEntry:function(){return {status:"pending",permissions:{},restriction:{status:"not_checked"}};},
    allows:function(entry,action){
      return !!entry && (entry.status==="approved"||entry.status==="partial") &&
        entry.permissions?.[action]===true &&
        (action==="gpxOfficialLink" || entry.restriction?.status==="clear");
    },
    canProcess:function(entry){return this.PROCESS_ACTIONS.every(key=>this.allows(entry,key));},
    canDownload:function(entry){return this.allows(entry,"gpxFileUserDownload");},
    canLink:function(entry){return this.allows(entry,"gpxOfficialLink");},
    isDirectFileUrl:function(url){
      const value=String(url||"");
      return /\.gpx(?:$|[?#])/i.test(value) || /drive\.google\.com\/(?:file\/d\/|uc\?export=download)/i.test(value);
    },
    shouldBlockFetch:function(url,entry,knownRouteGpx){
      return (this.isDirectFileUrl(url)||!!knownRouteGpx) && !this.canProcess(entry);
    }
  };
  let policy=window.GpxRightsPolicy||fallbackPolicy;
  let registry={schemaVersion:1,defaultPolicy:"deny",routes:{}};
  let registryReady=false;
  const events=()=>typeof EVENTS!=="undefined"&&Array.isArray(EVENTS)?EVENTS:[];
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const findRouteById=id=>{
    if(!id)return null;
    for(const event of events()){
      const route=(event.routes||[]).find(r=>String(r.id)===String(id));
      if(route)return route;
    }
    return null;
  };
  const rightsFor=route=>{
    if(!route||!route.id)return policy.defaultEntry();
    return registry.routes?.[String(route.id)]||policy.defaultEntry();
  };
  const actualRoute=route=>{
    if(route?.id&&String(route.id).startsWith("review_")&&window.__gpxReviewRouteId){
      return findRouteById(window.__gpxReviewRouteId)||null;
    }
    return route?.id?findRouteById(route.id)||route:null;
  };
  const canProcess=route=>!!route&&policy.canProcess(rightsFor(actualRoute(route)));
  const canDownload=route=>!!route&&policy.canDownload(rightsFor(actualRoute(route)));
  const canLink=route=>!!route&&policy.canLink(rightsFor(actualRoute(route)));
  const blockedMessage=route=>{
    const status=String(rightsFor(actualRoute(route)).restriction?.status||"not_checked").toLowerCase();
    if(status==="withheld_until_race_week"||status.includes("restricted")||status.includes("prohibit")||status.includes("forbidden")){
      return "GPX durch Veranstalter eingeschränkt – kein Download möglich.";
    }
    return "GPX gesperrt – keine ausdrückliche Freigabe dokumentiert; kein Download möglich.";
  };
  const routeForInput=input=>{
    const event=events().find(e=>String(e.id)===String(input?.dataset?.gpxEvent||""));
    return event?.routes?.find(r=>String(r.id)===String(input?.dataset?.gpxRoute||""))||null;
  };
  const routeFromPanel=panel=>{
    const match=String(panel?.id||"").match(/^routeInfo(\d+)_(\d+)$/);
    return match?events()[Number(match[1])]?.routes?.[Number(match[2])]||null:null;
  };
  const routeForPayload=payload=>{
    const eventId=payload?.eventId||payload?.event?.id||payload?.route?.eventId||payload?.newRoute?.eventId;
    const routeId=payload?.routeId||payload?.route?.id||payload?.newRoute?.id;
    const routeName=payload?.routeName||payload?.route?.name||payload?.newRoute?.name;
    if(routeId){
      const byId=findRouteById(routeId);
      if(byId)return byId;
    }
    const event=events().find(e=>String(e.id)===String(eventId));
    if(event&&routeName){
      const byName=(event.routes||[]).find(r=>[r.name,r.route].some(v=>String(v||"")===String(routeName)));
      if(byName)return byName;
    }
    return null;
  };
  const routeByGpxUrl=url=>{
    const value=String(url||"");
    for(const event of events()){
      for(const route of event.routes||[]){
        if([route.gpxDownloadUrl,route.gpxUrl,route.gpxFileUrl].some(candidate=>candidate&&String(candidate)===value))return route;
      }
    }
    return null;
  };
  const permissionForLink=(route,href)=>{
    return policy.isDirectFileUrl(href)?canDownload(route):(canLink(route)||canDownload(route));
  };

  window.gpxRightsRegistry=registry;
  window.gpxRightsAllows=(routeId,action)=>policy.allows(registry.routes?.[String(routeId)]||policy.defaultEntry(),action);
  window.routeGpxIsOrganizerRestricted=route=>!canProcess(route);
  window.routeHasDownloadableGpx=route=>{
    const href=route?.gpxDownloadUrl||route?.gpxUrl||"";
    return policy.isDirectFileUrl(href)?canDownload(route):(canLink(route)||canDownload(route));
  };
  window.isGpxImportableUrl=(url,status)=>{
    if(/stale|historical|candidate|unversioned|needs-validation|not-current|not-published|not-verified|pending/i.test(String(status||"")))return false;
    const route=routeByGpxUrl(url);
    return !!route&&canProcess(route)&&policy.isDirectFileUrl(url);
  };

  const originalProposalRestricted=window.proposalGpxIsRestricted;
  window.proposalGpxIsRestricted=payload=>{
    const route=routeForPayload(payload);
    return !route||!canProcess(route);
  };
  const originalReviewGpxUrl=window.reviewGpxUrl;
  window.reviewGpxUrl=payload=>{
    const route=routeForPayload(payload);
    if(!route||!canProcess(route)||!canDownload(route))return "";
    return typeof originalReviewGpxUrl==="function"?originalReviewGpxUrl(payload):"";
  };

  const originalRenderGpxMap=window.renderGpxMap;
  if(typeof originalRenderGpxMap==="function"){
    window.renderGpxMap=function(route){
      const source=actualRoute(route);
      if(!source||!canProcess(source))return '<div class="gpx-map-status">'+escapeHtml(blockedMessage(source))+'</div>';
      return originalRenderGpxMap.apply(this,arguments);
    };
  }
  const originalInitGpxMap=window.initGpxMap;
  if(typeof originalInitGpxMap==="function"){
    window.initGpxMap=function(route){
      const source=actualRoute(route);
      if(!source||!canProcess(source))return;
      return originalInitGpxMap.apply(this,arguments);
    };
  }
  const originalPersistGpxData=window.persistGpxData;
  if(typeof originalPersistGpxData==="function"){
    window.persistGpxData=function(route,event,ri,data,fileName){
      if(!canProcess(route))throw new Error(blockedMessage(route));
      return originalPersistGpxData.apply(this,arguments);
    };
  }
  const originalImportRouteGpx=window.importRouteGpx;
  if(typeof originalImportRouteGpx==="function"){
    window.importRouteGpx=async function(input){
      const route=routeForInput(input);
      if(!route||!canProcess(route)){
        const status=input?.closest?.(".edit-grid,.year-profile-panel")?.querySelector(".gpx-status");
        if(status)status.textContent=blockedMessage(route);
        if(input)input.value="";
        return;
      }
      return originalImportRouteGpx.apply(this,arguments);
    };
  }
  const originalImportGpxForRoute=window.importGpxForRoute;
  if(typeof originalImportGpxForRoute==="function"){
    window.importGpxForRoute=async function(id,ri,input){
      const route=events()[Number(id)]?.routes?.[Number(ri)];
      if(!route||!canProcess(route)){
        if(input)input.value="";
        alert(blockedMessage(route));
        return;
      }
      return originalImportGpxForRoute.apply(this,arguments);
    };
  }
  const originalImportRemoteGpxForRoute=window.importRemoteGpxForRoute;
  if(typeof originalImportRemoteGpxForRoute==="function"){
    window.importRemoteGpxForRoute=async function(id,ri,url,button){
      const route=events()[Number(id)]?.routes?.[Number(ri)];
      if(!route||!canProcess(route)){
        if(button){button.disabled=true;button.textContent="GPX gesperrt";}
        alert(blockedMessage(route));
        return;
      }
      return originalImportRemoteGpxForRoute.apply(this,arguments);
    };
  }
  const originalOpenReviewGpx=window.openReviewGpx;
  if(typeof originalOpenReviewGpx==="function"){
    window.openReviewGpx=async function(input){
      const article=input?.closest?.("article");
      const pre=article?.querySelector?.("details.review-extra pre");
      let payload=null;
      try{payload=JSON.parse(pre?.textContent||"{}");}catch{}
      const route=routeForPayload(payload);
      const target=article?.querySelector?.("[data-review-gpx-preview]");
      if(!route||!canProcess(route)){
        if(target)target.innerHTML='<p class="plan-meta">'+escapeHtml(blockedMessage(route))+'</p>';
        if(input)input.value="";
        return;
      }
      const previous=window.__gpxReviewRouteId;
      window.__gpxReviewRouteId=route.id;
      try{return await originalOpenReviewGpx.apply(this,arguments);}
      finally{window.__gpxReviewRouteId=previous;}
    };
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const url=typeof input==="string"?input:(input?.url||"");
    const route=routeByGpxUrl(url);
    const knownRouteGpx=!!route;
    const entry=route?rightsFor(route):policy.defaultEntry();
    if(policy.shouldBlockFetch(url,entry,knownRouteGpx)){
      return Promise.reject(new Error(blockedMessage(route)));
    }
    return originalFetch(input,init);
  };

  function reviewPayloadFromInput(input){
    const article=input?.closest?.("article");
    const pre=article?.querySelector?.("details.review-extra pre");
    try{return JSON.parse(pre?.textContent||"{}");}catch{return null;}
  }
  function applyGpxUi(root){
    const scope=root&&root.querySelectorAll?root:document;
    scope.querySelectorAll('[id^="routeInfo"]').forEach(panel=>{
      const route=routeFromPanel(panel);
      if(!route)return;
      const linkAllowed=canLink(route),downloadAllowed=canDownload(route),processAllowed=canProcess(route);
      panel.querySelectorAll("a[href]").forEach(link=>{
        const href=link.getAttribute("href")||"";
        const direct=policy.isDirectFileUrl(href);
        const matches=[route.gpxDownloadUrl,route.gpxUrl,route.gpxFileUrl].some(v=>v&&String(v)===href);
        const isGpx=direct||matches||/gpx/i.test(link.textContent||"");
        if(isGpx&&!permissionForLink(route,href))link.remove();
      });
      if(!processAllowed){
        panel.querySelectorAll("button").forEach(button=>{
          if(/gpx/i.test(button.textContent||""))button.remove();
        });
      }
      const hasGpxReference=!!(route.gpxDownloadUrl||route.gpxUrl||route.gpxAvailability||route.gpxStatusNote||route.gpxTrack||route.gpxFileName);
      if(hasGpxReference&&!processAllowed&&!panel.querySelector("[data-gpx-rights-status]")){
        const note=document.createElement("p");
        note.className="plan-meta";
        note.dataset.gpxRightsStatus="1";
        note.textContent=linkAllowed&&!downloadAllowed
          ?"GPX-Datei selbst nicht freigegeben; nur ein separat erlaubter offizieller GPX-Seitenlink darf angezeigt werden."
          :blockedMessage(route);
        panel.appendChild(note);
      }
    });
    scope.querySelectorAll('input[data-gpx-event][data-gpx-route]').forEach(input=>{
      const route=routeForInput(input);
      if(route&&!canProcess(route)){
        const message=blockedMessage(route);
        if(!input.disabled)input.disabled=true;
        if(input.title!==message)input.title=message;
        const status=input.closest(".edit-grid,.year-profile-panel")?.querySelector(".gpx-status");
        if(status&&status.textContent!==message)status.textContent=message;
      }
    });
    scope.querySelectorAll("input[data-review-gpx]").forEach(input=>{
      const route=routeForPayload(reviewPayloadFromInput(input));
      if(!route||!canProcess(route)){
        input.disabled=true;
        input.title=blockedMessage(route);
      }
    });
  }

  function purgeUnauthorizedGpxData(){
    if(!registryReady)return {deferred:true};
    let changed=false,routesCleared=0,recordsCleared=0;
    const keys=["gpxTrack","gpxDistanceKm","gpxAscentHm","gpxDescentHm","gpxFileName"];
    events().forEach((event,eventIndex)=>{
      (event.routes||[]).forEach((route,routeIndex)=>{
        if(canProcess(route))return;
        let routeHadData=false;
        keys.forEach(key=>{
          if(route[key]!==undefined){delete route[key];routeHadData=true;changed=true;}
        });
        if(String(route.profileSource||"").startsWith("Streckendatei:")){
          delete route.elevationProfile;
          delete route.profileSource;
          routeHadData=true;
          changed=true;
        }
        if(routeHadData)routesCleared++;
        if(typeof eventDataEdits!=="undefined"&&eventDataEdits){
          const key=typeof routeKey==="function"?routeKey(eventIndex,routeIndex):String(event.id)+"::"+String(route.id);
          const edit=eventDataEdits[key];
          if(edit){
            let editHadData=false;
            keys.forEach(field=>{
              if(edit[field]!==undefined){delete edit[field];editHadData=true;}
            });
            if(String(edit.profileSource||"").startsWith("Streckendatei:")){
              delete edit.elevationProfile;
              delete edit.profileSource;
              editHadData=true;
            }
            if(editHadData){
              recordsCleared++;
              changed=true;
              if(!Object.keys(edit).length)delete eventDataEdits[key];
            }
          }
        }
      });
    });
    if(changed){
      try{if(typeof eventDataEdits!=="undefined")localStorage.setItem("trailEventDataEdits",JSON.stringify(eventDataEdits));}catch{}
      try{if(typeof queuePlannerCloudSave==="function")queuePlannerCloudSave();}catch{}
    }
    window.gpxRightsPurgeSummary={changed,routesCleared,recordsCleared,checkedAt:new Date().toISOString()};
    return window.gpxRightsPurgeSummary;
  }

  const originalRender=window.render;
  if(typeof originalRender==="function"){
    window.render=function(){
      const result=originalRender.apply(this,arguments);
      applyGpxUi(document);
      return result;
    };
  }
  const originalRenderReviewQueue=window.renderReviewQueue;
  if(typeof originalRenderReviewQueue==="function"){
    window.renderReviewQueue=function(){
      const result=originalRenderReviewQueue.apply(this,arguments);
      applyGpxUi(document);
      return result;
    };
  }
  const originalApplyLocalEdits=window.applyLocalEventDataEdits;
  if(typeof originalApplyLocalEdits==="function"){
    window.applyLocalEventDataEdits=function(){
      const result=originalApplyLocalEdits.apply(this,arguments);
      if(registryReady)purgeUnauthorizedGpxData();
      applyGpxUi(document);
      return result;
    };
  }

  document.addEventListener("click",event=>{
    const link=event.target?.closest?.("a[href]");
    if(!link)return;
    const href=link.getAttribute("href")||"";
    const panel=link.closest('[id^="routeInfo"]');
    const route=panel?routeFromPanel(panel):routeByGpxUrl(href);
    const direct=policy.isDirectFileUrl(href);
    const isGpx=direct||/gpx/i.test(link.textContent||"")||(route&&[route.gpxDownloadUrl,route.gpxUrl,route.gpxFileUrl].some(v=>v&&String(v)===href));
    if(!isGpx)return;
    if(!route||!permissionForLink(route,href)){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert(blockedMessage(route));
    }
  },true);

  if(typeof MutationObserver!=="undefined"&&document.body){
    const observer=new MutationObserver(()=>applyGpxUi(document));
    observer.observe(document.body,{childList:true,subtree:true});
  }
  applyGpxUi(document);

  function loadPolicyScript(){
    if(window.GpxRightsPolicy){policy=window.GpxRightsPolicy;return Promise.resolve();}
    return new Promise(resolve=>{
      const script=document.createElement("script");
      script.src="./gpx-rights-policy.js?v=20261121";
      script.onload=()=>{policy=window.GpxRightsPolicy||fallbackPolicy;resolve();};
      script.onerror=()=>resolve();
      document.head.appendChild(script);
    });
  }
  function loadRightsRegistry(){
    return originalFetch("./gpx-rights.json?v=20261121",{cache:"no-store"})
      .then(response=>{if(!response.ok)throw new Error("HTTP "+response.status);return response.json();})
      .then(data=>{
        if(data.defaultPolicy!=="deny"||!data.routes)throw new Error("Invalid GPX rights registry");
        registry=data;
        window.gpxRightsRegistry=data;
      })
      .catch(error=>{
        registry={schemaVersion:1,defaultPolicy:"deny",routes:{}};
        window.gpxRightsRegistry=registry;
        window.gpxRightsRegistryError=String(error?.message||error);
      });
  }
  Promise.all([loadPolicyScript(),loadRightsRegistry()]).then(()=>{
    registryReady=true;
    purgeUnauthorizedGpxData();
    applyGpxUi(document);
    if(typeof window.render==="function")window.render();
    if(typeof window.renderReviewQueue==="function")window.renderReviewQueue();
  });
})();
