/* NORTHBOUND – Strava-Aktivitäten direkt abgeschlossenen Wettkämpfen zuordnen */
(function(){
 let links=[],loaded=false,loading=false,activeUserId=null,authListenerInstalled=false,loadGeneration=0;
 const $=id=>document.getElementById(id);
 const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function status(message){const el=$('stravaRaceLinkStatus');if(el)el.textContent=message;}
 function baseKey(id,ri){return typeof routeKey==='function'?routeKey(id,ri):String(id)+'::'+String(ri);}
 function completedTargets(){
  if(typeof collectCompletedRuns!=='function')return[];
  return collectCompletedRuns().map(x=>{
   const key=baseKey(x.id,x.ri),attempt=Number.isInteger(x.attemptIndex),base=typeof runRecords!=='undefined'?runRecords[key]:null;
   if(attempt&&!/^\d{4}-\d{2}-\d{2}$/.test(String(x.r.date||'')))return null;
   if(!attempt&&(!base||base.done!==true))return null;
   const created=x.r.createdAt!==undefined&&x.r.createdAt!==''&&Number.isFinite(Number(x.r.createdAt))?'::'+String(x.r.createdAt):'';
   const recordKey=attempt?key+'::attempt::'+String(x.r.date)+created:key;
   return{key:recordKey,label:(x.ev.name||'Event')+' – '+(x.route.route||'Strecke')+' · '+String(x.r.year||x.r.date?.slice(0,4)||base?.year||'Jahr offen')+(x.r.date?' · '+x.r.date:'')};
  }).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>y.key===x.key)===i);
 }
 function syncUserScope(){const id=typeof cloudUser!=='undefined'&&cloudUser?cloudUser.id:null;if(id!==activeUserId){activeUserId=id;links=[];loaded=false;loading=false;loadGeneration++;}return!!id;}
 async function loadLinks(){
  if(loading||typeof cloudClient==='undefined'||!cloudClient||!syncUserScope())return;
  loading=true;const userId=cloudUser.id,generation=loadGeneration;
  try{const{data,error}=await cloudClient.from('strava_race_activity_links').select('id,activity_id,run_record_key,stage_order,stage_name').eq('user_id',userId).order('stage_order');if(error)throw error;
   if(generation!==loadGeneration||activeUserId!==userId||cloudUser?.id!==userId)return;
   links=data||[];loaded=true;status(links.length+' Strava-Zuordnungen gespeichert.');
  }catch(e){if(generation===loadGeneration)status('Zuordnungen konnten nicht geladen werden. ('+(e.message||'Tabelle nicht erreichbar')+')');}
  finally{if(generation===loadGeneration){loading=false;renderControls();}}
 }
 function activityLabel(a){const date=a.started_at?new Date(a.started_at).toLocaleDateString('de-DE'):'Datum unbekannt';const km=Number(a.distance_m)>0?(Number(a.distance_m)/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km':'Distanz offen';return(a.name||'Strava-Aktivität')+' · '+date+' · '+km;}
 function renderControls(){
  const root=$('historyList');if(!root)return;
  if(!syncUserScope()||!loaded){root.querySelectorAll('.strava-race-link-editor').forEach(e=>e.remove());return;}
  if(stravaHistoryCategory!=='race')return;
  root.querySelectorAll('[data-run-record-key]').forEach(card=>{
   if(card.querySelector('.strava-race-link-editor'))return;
   const key=card.dataset.runRecordKey;if(!key)return;
   const assigned=links.filter(x=>x.run_record_key===key),editor=document.createElement('section');
   editor.className='strava-race-link-editor';editor.style.cssText='margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--bg)';
   const activityById=id=>(Array.isArray(stravaActivityCache)?stravaActivityCache:[]).find(a=>String(a.id)===String(id));
   let assignedHtml='';
   if(assigned.length){assignedHtml='<strong>Verknüpfte Strava-Aktivitäten</strong>'+assigned.map(link=>{const a=activityById(link.activity_id);return'<div class="plan-meta" style="margin-top:7px">'+escHtml(a?activityLabel(a):'Aktivität nicht mehr im aktuellen Abruf')+' · Etappe '+link.stage_order+(link.stage_name?' – '+escHtml(link.stage_name):'')+' <button type="button" class="secondary" data-unlink-race="'+escHtml(link.id)+'" style="margin-left:6px">Lösen</button></div>';}).join('');}
   const allActivities=Array.isArray(stravaActivityCache)?stravaActivityCache:[];
   const available=allActivities.filter(a=>!links.some(l=>l.activity_id===a.id));
   editor.innerHTML=assignedHtml+'<div style="margin-top:10px"><strong>Strava-Aktivität zuordnen</strong><label class="plan-meta" style="display:block;margin-top:7px">Passende Aktivität<select class="field" data-race-activity style="margin-top:4px"><option value="">Strava-Aktivität auswählen …</option>'+available.map(a=>'<option value="'+escHtml(a.id)+'">'+escHtml(activityLabel(a))+'</option>').join('')+'</select></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label class="plan-meta">Etappennummer<input class="field" type="number" min="1" step="1" value="'+(assigned.length+1)+'" data-race-stage></label><label class="plan-meta">Etappenname<input class="field" type="text" maxlength="80" placeholder="Optional" data-race-stage-name></label></div><button type="button" class="secondary" data-link-race style="margin-top:9px" '+(available.length?'':'disabled')+'>Aktivität diesem Wettkampf zuordnen</button>'+(allActivities.length?'':'<p class="plan-meta">Noch keine Strava-Aktivitäten geladen. Öffne Training und synchronisiere Strava.</p>')+'</div>';
   card.appendChild(editor);
  });
 }
 async function assign(button){
  const card=button.closest('[data-run-record-key]'),key=card?.dataset.runRecordKey,activityId=card?.querySelector('[data-race-activity]')?.value,activity=(stravaActivityCache||[]).find(x=>String(x.id)===String(activityId)),stage=Number(card?.querySelector('[data-race-stage]')?.value||1),stageName=card?.querySelector('[data-race-stage-name]')?.value.trim()||null;
  if(!activity?.id||!key||!Number.isInteger(stage)||stage<1){status('Bitte eine Strava-Aktivität und eine gültige Etappennummer auswählen.');return;}
  if(!confirm('Diese Strava-Aktivität dem angezeigten Wettkampf zuordnen?\n\nDie Aktivität und der Laufhistorieneintrag bleiben unverändert.'))return;
  button.disabled=true;
  try{const{data,error}=await cloudClient.from('strava_race_activity_links').insert({user_id:cloudUser.id,activity_id:activity.id,run_record_key:key,stage_order:stage,stage_name:stageName}).select('id,activity_id,run_record_key,stage_order,stage_name').single();if(error)throw error;links.push(data);status('Strava-Aktivität wurde dem Wettkampf zugeordnet.');if(typeof renderHistory==='function')renderHistory();renderControls();}
  catch(e){status('Zuordnung nicht gespeichert: '+(e.message||'Unbekannter Fehler'));button.disabled=false;}
 }
 async function unlink(button){
  const id=button.dataset.unlinkRace;if(!id||!confirm('Zuordnung wirklich lösen? Strava-Aktivität und Wettkampf bleiben erhalten.'))return;
  button.disabled=true;const{error}=await cloudClient.from('strava_race_activity_links').delete().eq('user_id',cloudUser.id).eq('id',id);
  if(error){status('Zuordnung konnte nicht gelöst werden: '+error.message);button.disabled=false;return;}
  links=links.filter(x=>x.id!==id);status('Zuordnung gelöst.');if(typeof renderHistory==='function')renderHistory();renderControls();
 }
 function install(){
  const history=$('historyList');if(!history)return;
  if(!authListenerInstalled&&typeof cloudClient!=='undefined'&&cloudClient?.auth?.onAuthStateChange){authListenerInstalled=true;cloudClient.auth.onAuthStateChange((_event,session)=>{const next=session?.user?.id||null;if(next!==activeUserId){activeUserId=next;loadGeneration++;links=[];loaded=false;loading=false;history.querySelectorAll('.strava-race-link-editor').forEach(e=>e.remove());if(next)setTimeout(loadLinks,0);}});}
  if(!$('stravaRaceLinkStatus')){const p=document.createElement('p');p.id='stravaRaceLinkStatus';p.className='plan-meta';p.setAttribute('role','status');p.style.margin='10px 0';history.parentNode.insertBefore(p,history);}
  if(typeof window.renderHistory==='function'&&!window.renderHistory.__raceLinksWrapped){const original=window.renderHistory,wrapped=function(){original();renderControls();};wrapped.__raceLinksWrapped=true;window.renderHistory=wrapped;}
  history.addEventListener('click',e=>{const a=e.target.closest('[data-link-race]');if(a){assign(a);return;}const u=e.target.closest('[data-unlink-race]');if(u)unlink(u);});
  if(typeof cloudUser!=='undefined'&&typeof cloudClient!=='undefined'&&cloudUser&&cloudClient)loadLinks();
 }
 document.addEventListener('DOMContentLoaded',install);
 document.addEventListener('click',e=>{if(e.target.closest('#raceHistoryMenuButton,[data-run-record-key]'))setTimeout(()=>{if(!loaded)loadLinks();renderControls();},150);});
 document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if($('historyList')&&!$('stravaRaceLinkStatus'))install();}).observe(document.body,{childList:true,subtree:true}));
})();