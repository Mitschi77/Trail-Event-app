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
window.renderSeasonEnhancements=function(){original();};
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


/* Keep the live training summary mounted when the cockpit is refreshed. */
const originalCockpitRender=window.renderSeasonCockpit;
if(typeof originalCockpitRender==='function'){
 window.renderSeasonCockpit=function(){originalCockpitRender();};;
 window.renderSeasonCockpit();
}


/* Read imported Strava activities separately from completed race records.
   This keeps Training and Competitions as independent data domains. */
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
 const hours=(n)=>((n||0)/3600).toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
 const types={};
 currentRows.forEach(a=>{const raw=String(a.sport_type||'Other').toLowerCase();let label=/run|trail|hike|walk/.test(raw)?'Run & Trail':/ride|bike|cycling|virtualride/.test(raw)?'Bike':/yoga/.test(raw)?'Yoga':raw==='other'?'Weitere':String(a.sport_type||'Weitere');types[label]=(types[label]||0)+1;});
 const typeHtml=Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([label,count])=>'<span class="strava-sport-chip">'+escText(label)+' <b>'+count+'</b></span>').join('')||'<span class="plan-meta">Noch keine Aktivitäten in dieser Woche</span>';
 const stat=(value,label)=>'<div class="season-kpi"><strong>'+value+'</strong><span>'+label+'</span></div>';
 box.innerHTML='<div class="season-training-heading"><div><span class="nb-eyebrow">NORTHBOUND · TRAINING</span><h3>Deine Strava-Woche</h3><p>Importierte Trainingsaktivitäten – unabhängig von deinen Wettkampfergebnissen.</p></div><span class="season-training-period">AKTUELLE WOCHE</span></div><div class="season-dashboard-stats">'+stat(fmt(current.km)+' km','Distanz')+stat(Math.round(current.hm).toLocaleString('de-DE')+' hm','Höhenmeter')+stat(current.count,'Aktivitäten')+stat(hours(current.seconds),'Bewegungszeit')+'</div><div class="strava-sport-breakdown"><strong>Sportarten diese Woche</strong><div>'+typeHtml+'</div></div><p class="season-training-note">Vorwoche: '+fmt(previous.km)+' km · '+Math.round(previous.hm).toLocaleString('de-DE')+' hm · '+previous.count+' Aktivitäten · '+hours(previous.seconds)+'. Grundlage: '+rows.length+' importierte Strava-Aktivitäten im geladenen Zeitraum.</p></div>';
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
  stravaCockpitPanel(stravaCockpitRows,stravaCockpitRows.length?'':'Noch keine Strava-Aktivitäten importiert. Öffne Training und synchronisiere Strava.');
 })().catch(error=>{stravaCockpitPanel(null,'Strava-Daten konnten nicht geladen werden. Bitte Verbindung und Synchronisation im Bereich Training prüfen.');}).finally(()=>{stravaCockpitRequest=null;});
 await stravaCockpitRequest;
}
const stravaCockpitStyle=document.createElement('style');
stravaCockpitStyle.textContent='#strava-cockpit-panel .season-dashboard-stats{margin-top:12px}#strava-cockpit-panel .season-kpi{min-width:0}#strava-cockpit-panel .season-kpi strong{font-size:19px}#strava-cockpit-panel .strava-sport-breakdown{margin-top:13px}#strava-cockpit-panel .strava-sport-breakdown>strong{font-size:12px}#strava-cockpit-panel .strava-sport-breakdown>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.strava-sport-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-size:11px}.strava-sport-chip b{color:#FF6A00}';
document.head.querySelector('#strava-cockpit-style')?.remove();stravaCockpitStyle.id='strava-cockpit-style';document.head.appendChild(stravaCockpitStyle);
const cockpitRenderWithStrava=window.renderSeasonCockpit;
if(typeof cockpitRenderWithStrava==='function'){
 window.renderSeasonCockpit=function(){cockpitRenderWithStrava();loadStravaCockpit();};
 window.renderSeasonCockpit();
}

})();
