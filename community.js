/* NORTHBOUND Community MVP UI – additive module. */
(()=>{'use strict';
const TABLE='community_trails',ASSETS='community_trail_assets',BUCKET='community-trail-assets';
const $=(id,root=document)=>root.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtDistance=m=>Number.isFinite(Number(m))?(Number(m)/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km':'—';
const fmtHm=m=>Number.isFinite(Number(m))?Math.round(Number(m)).toLocaleString('de-DE')+' hm':'—';
const labels={easy:'Leicht',moderate:'Mittel',difficult:'Schwer',technical:'Technisch',expert:'Experte'};
let active='discover',trails=[],busy=false;
function root(){return $('northboundCommunity');}
function setStatus(message,error=false){const el=$('communityStatus');if(el){el.textContent=message;el.classList.toggle('is-error',error);}}
function client(){return typeof cloudClient!=='undefined'&&cloudClient&&typeof cloudUser!=='undefined'&&cloudUser?cloudClient:null;}
function shell(){
 if(root())return;
 const menu=document.querySelector('.northbound-primary-links details');
 if(menu){
  const button=document.createElement('button');button.type='button';button.id='communityTabButton';button.className='more-nav-item';button.setAttribute('aria-controls','northboundCommunity');button.textContent='🌲 Trail Community';menu.append(button);
  button.addEventListener('click',()=>{if(typeof switchTab==='function')switchTab('community');else show();});
 }
 const events=$('eventsTab');
 if(!events)return;
 const section=document.createElement('section');section.className='tab-panel';section.id='northboundCommunity';section.hidden=true;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','communityTabButton');
 section.innerHTML=`
 <div class="community-head"><div><span class="community-eyebrow">NORTHBOUND · COMMUNITY</span><h2>Trail Community</h2><p>Entdecke und teile Laufstrecken mit der Community.</p></div><button type="button" class="community-primary" id="communityNewTrail">＋ Trail hinzufügen</button></div>
 <div class="community-tabs" role="tablist" aria-label="Community-Bereiche"><button type="button" data-community-view="discover" aria-selected="true">Entdecken</button><button type="button" data-community-view="mine" aria-selected="false">Meine Trails</button></div>
 <div class="community-toolbar" id="communityFilters"><label class="community-search">Suche<input id="communitySearch" type="search" placeholder="Trail, Region oder Beschreibung"></label><label>Schwierigkeit<select id="communityDifficulty"><option value="">Alle</option><option value="easy">Leicht</option><option value="moderate">Mittel</option><option value="difficult">Schwer</option><option value="technical">Technisch</option><option value="expert">Experte</option></select></label></div>
 <div id="communityStatus" class="community-status" role="status" aria-live="polite">Community wird geladen …</div><div id="communityTrailList" class="community-grid"></div>
 <form id="communityTrailForm" class="community-form" hidden>
  <div class="community-form-head"><div><span class="community-eyebrow">DEIN TRAIL</span><h3>Trail hinzufügen</h3><p>Neue Trails sind zunächst privat und bleiben Entwürfe, bis du sie veröffentlichst.</p></div><button type="button" class="community-close" id="communityCancel">Schließen ✕</button></div>
  <div class="community-form-grid">
   <label class="wide">Name des Trails *<input name="title" maxlength="120" required placeholder="z. B. Panoramarunde am …"></label>
   <label class="wide">Beschreibung<textarea name="description" maxlength="10000" rows="3" placeholder="Streckencharakter, Hinweise und Besonderheiten"></textarea></label>
   <label>Region<input name="region_name" maxlength="120" placeholder="z. B. Chiemgau"></label>
   <label>Land (2 Buchstaben)<input name="country_code" maxlength="2" placeholder="DE"></label>
   <label>Distanz (km)<input name="distance_km" type="number" min="0.1" step="0.1" placeholder="z. B. 18.5"></label>
   <label>Aufstieg (hm)<input name="ascent_m" type="number" min="0" step="1" placeholder="z. B. 950"></label>
   <label>Abstieg (hm)<input name="descent_m" type="number" min="0" step="1" placeholder="z. B. 950"></label>
   <label>Schwierigkeit<select name="difficulty"><option value="">Nicht angegeben</option><option value="easy">Leicht</option><option value="moderate">Mittel</option><option value="difficult">Schwer</option><option value="technical">Technisch</option><option value="expert">Experte</option></select></label>
   <label class="wide">Untergrund<input name="surface_summary" maxlength="500" placeholder="z. B. Waldwege, Fels, Schotter"></label>
   <label class="wide">Startpunkt-Bezeichnung (optional)<input name="start_location_label" maxlength="160" placeholder="Keine private Wohnadresse angeben"></label>
   <label class="wide">Bilder (JPG, PNG, WebP; max. 25 MB je Datei)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
   <label class="wide">GPX-Datei (optional; max. 25 MB)<input name="gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"></label>
   <label class="community-check"><input name="visibility" type="checkbox"> Trail öffentlich veröffentlichen</label>
   <label class="community-check"><input name="gpx_download_enabled" type="checkbox"> GPX-Download erlauben</label>
   <p class="community-hint wide">GPX kann nur heruntergeladen werden, wenn sowohl der Trail als auch die einzelne GPX-Datei freigegeben sind. Die Freigabe lässt sich später ändern.</p>
  </div>
  <div class="community-form-actions"><button type="button" class="community-secondary" id="communityCancelBottom">Abbrechen</button><button type="submit" class="community-primary" id="communitySaveTrail">Trail speichern</button></div>
 </form>
 <div id="communityDetail" class="community-detail" hidden></div>`;
 events.parentNode.insertBefore(section,events);
 section.querySelectorAll('[data-community-view]').forEach(btn=>btn.addEventListener('click',()=>{active=btn.dataset.communityView;section.querySelectorAll('[data-community-view]').forEach(x=>x.setAttribute('aria-selected',String(x===btn)));$('communityFilters').hidden=active==='mine';load();}));
 $('communityNewTrail').addEventListener('click',openForm);
 $('communityCancel').addEventListener('click',closeForm);$('communityCancelBottom').addEventListener('click',closeForm);
 $('communityTrailForm').addEventListener('submit',saveTrail);
 $('communitySearch').addEventListener('input',render);$('communityDifficulty').addEventListener('change',render);
}
function show(){shell();const panel=root();if(!panel)return;document.querySelectorAll('.tab-panel').forEach(el=>el.hidden=el!==panel);document.querySelectorAll('.more-nav-item[aria-pressed]').forEach(el=>el.setAttribute('aria-pressed','false'));$('communityTabButton')?.setAttribute('aria-pressed','true');$('appMenuDropdown')&&( $('appMenuDropdown').hidden=true);load();}
function openForm(){if(!client()){setStatus('Bitte zuerst anmelden. Die Community-Datenbank ist noch nicht mit deinem Konto verfügbar.',true);return;}$('communityDetail').hidden=true;$('communityTrailList').hidden=true;$('communityTrailForm').hidden=false;}
function closeForm(){$('communityTrailForm').hidden=true;$('communityTrailList').hidden=false;}
async function load(){
 const c=client();if(!c){setStatus('Bitte anmelden, um die Trail Community zu nutzen. Öffentliche Trails sind nach Freischaltung der Community-Datenbank sichtbar.');$('communityTrailList').replaceChildren();return;}
 setStatus('Lade Trails …');
 try{
  let q=c.from(TABLE).select('id,owner_id,title,description,visibility,publication_status,distance_m,ascent_m,descent_m,difficulty,region_name,country_code,gpx_download_enabled,created_at,published_at').order('updated_at',{ascending:false}).limit(100);
  q=active==='mine'?q.eq('owner_id',cloudUser.id):q.eq('visibility','public').eq('publication_status','published');
  const {data,error}=await q;if(error)throw error;trails=data||[];render();setStatus(trails.length?trails.length+' Trail(s) gefunden.':active==='mine'?'Du hast noch keine eigenen Trails.':'Noch keine öffentlichen Trails vorhanden.'); 
 }catch(error){trails=[];render();setStatus(/relation .* does not exist|schema cache/i.test(error.message||'')?'Die Community-Datenbank ist noch nicht freigeschaltet. Die Migration wartet auf die separate Freigabe.':'Trails konnten nicht geladen werden: '+error.message,true);}
}
function render(){
 const list=$('communityTrailList');if(!list)return;const term=($('communitySearch')?.value||'').trim().toLocaleLowerCase('de-DE'),difficulty=$('communityDifficulty')?.value||'';
 const rows=trails.filter(t=>(!difficulty||t.difficulty===difficulty)&&(!term||[t.title,t.description,t.region_name,t.country_code].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(term))));
 list.replaceChildren();
 rows.forEach(t=>{const card=document.createElement('article');card.className='community-card';const title=document.createElement('h3');title.textContent=t.title;const region=document.createElement('p');region.className='community-region';region.textContent=[t.region_name,t.country_code].filter(Boolean).join(' · ')||'Region nicht angegeben';const metrics=document.createElement('div');metrics.className='community-metrics';metrics.textContent=fmtDistance(t.distance_m)+'  ·  '+fmtHm(t.ascent_m);const difficultyEl=document.createElement('span');difficultyEl.className='community-difficulty';difficultyEl.textContent=labels[t.difficulty]||'Schwierigkeit offen';const desc=document.createElement('p');desc.textContent=t.description||'Keine Beschreibung vorhanden.';desc.className='community-description';const action=document.createElement('button');action.type='button';action.className='community-secondary';action.textContent=active==='mine'?'Details / verwalten':'Trail ansehen';action.addEventListener('click',()=>detail(t));card.append(title,region,metrics,difficultyEl,desc,action);if(active==='mine'){const status=document.createElement('span');status.className='community-state';status.textContent=t.visibility==='private'?'Privat':t.publication_status==='draft'?'Entwurf':'Öffentlich';card.append(status);}list.append(card);});
 if(!rows.length){const empty=document.createElement('div');empty.className='community-empty';empty.textContent=active==='mine'?'Deine Trails erscheinen hier. Lege deinen ersten Trail an.':'Keine Trails passen zu deiner Suche. Passe die Filter an oder schau später wieder vorbei.';list.append(empty);}
}
function detail(t){const d=$('communityDetail');d.hidden=false;$('communityTrailList').hidden=true;$('communityTrailForm').hidden=true;d.replaceChildren();const back=document.createElement('button');back.type='button';back.className='community-secondary';back.textContent='← Zurück';back.addEventListener('click',()=>{d.hidden=true;$('communityTrailList').hidden=false;});const h=document.createElement('h3');h.textContent=t.title;const p=document.createElement('p');p.textContent=t.description||'Keine Beschreibung vorhanden.';const meta=document.createElement('p');meta.textContent=[t.region_name,t.country_code,fmtDistance(t.distance_m),fmtHm(t.ascent_m),labels[t.difficulty]||''].filter(Boolean).join(' · ');d.append(back,h,meta,p);if(active==='mine'){const toggle=document.createElement('button');toggle.type='button';toggle.className='community-secondary';toggle.textContent=t.visibility==='public'?'Auf privat setzen':'Öffentlich veröffentlichen';toggle.addEventListener('click',()=>updateVisibility(t));d.append(toggle);} }
async function updateVisibility(t){const c=client();if(!c)return;const visibility=t.visibility==='public'?'private':'public',status=visibility==='public'?'published':'draft';try{const {error}=await c.from(TABLE).update({visibility,publication_status:status,published_at:visibility==='public'?new Date().toISOString():null}).eq('id',t.id).eq('owner_id',cloudUser.id);if(error)throw error;setStatus('Sichtbarkeit aktualisiert.');await load();$('communityDetail').hidden=true;}catch(e){setStatus('Änderung fehlgeschlagen: '+e.message,true);}}
async function saveTrail(event){
 event.preventDefault();if(busy)return;const c=client();if(!c){setStatus('Bitte zuerst anmelden.',true);return;}const form=event.currentTarget,data=new FormData(form),title=String(data.get('title')||'').trim();if(!title){setStatus('Bitte einen Trail-Namen eingeben.',true);return;}
 const images=Array.from(form.elements.images.files||[]),gpx=form.elements.gpx.files?.[0]||null,files=[...images,...(gpx?[gpx]:[])];if(files.some(f=>f.size>26214400)){setStatus('Eine Datei überschreitet 25 MB.',true);return;}
 const visibility=form.elements.visibility.checked?'public':'private',gpxEnabled=form.elements.gpx_download_enabled.checked&&visibility==='public';
 busy=true;const button=$('communitySaveTrail');button.disabled=true;button.textContent='Speichere …';setStatus('Trail wird gespeichert …');
 let trailId=null,uploaded=[];
 try{
  const row={owner_id:cloudUser.id,title,description:String(data.get('description')||''),region_name:String(data.get('region_name')||'').trim()||null,country_code:String(data.get('country_code')||'').trim().toUpperCase()||null,distance_m:data.get('distance_km')?Number(data.get('distance_km'))*1000:null,ascent_m:data.get('ascent_m')?Number(data.get('ascent_m')):null,descent_m:data.get('descent_m')?Number(data.get('descent_m')):null,difficulty:String(data.get('difficulty')||'')||null,surface_summary:String(data.get('surface_summary')||'').trim()||null,start_location_label:String(data.get('start_location_label')||'').trim()||null,visibility,publication_status:visibility==='public'?'published':'draft',gpx_download_enabled:gpxEnabled,published_at:visibility==='public'?new Date().toISOString():null};
  const {data:created,error}=await c.from(TABLE).insert(row).select('id').single();if(error)throw error;trailId=created.id;
  for(const file of files){const isGpx=file===gpx,kind=isGpx?'gpx':'image',allowed=isGpx?['application/gpx+xml','application/xml','text/xml','']:['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type)){throw new Error('Nicht unterstützter Dateityp: '+file.name);}const safe=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90)||'file';const path=cloudUser.id+'/'+trailId+'/'+crypto.randomUUID()+'-'+safe;
   const {error:assetError}=await c.from(ASSETS).insert({trail_id:trailId,owner_id:cloudUser.id,asset_kind:kind,storage_path:path,content_type:isGpx?(file.type||'application/gpx+xml'):file.type,file_size:file.size,download_enabled:isGpx&&gpxEnabled});
   if(assetError)throw assetError;
   const {error:uploadError}=await c.storage.from(BUCKET).upload(path,file,{contentType:isGpx?(file.type||'application/gpx+xml'):file.type,upsert:false});if(uploadError)throw uploadError;uploaded.push(path);
  }
  setStatus(visibility==='public'?'Trail veröffentlicht.':'Trail privat gespeichert.');form.reset();closeForm();active='mine';document.querySelector('[data-community-view="mine"]')?.click();await load();
 }catch(error){setStatus('Speichern/Upload fehlgeschlagen: '+error.message,true);if(trailId){try{await c.from(TABLE).delete().eq('id',trailId).eq('owner_id',cloudUser.id);}catch(_){}}}
 finally{busy=false;button.disabled=false;button.textContent='Trail speichern';}
}
function styles(){if($('northboundCommunityStyles'))return;const style=document.createElement('style');style.id='northboundCommunityStyles';style.textContent=`
#northboundCommunity{color:var(--text,#f4f7fb);padding:8px 0 30px}.community-head,.community-form-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin:8px 0 18px}.community-eyebrow{font-size:10px;font-weight:850;letter-spacing:.14em;color:#7fd8ff}.community-head h2,.community-form h3{margin:5px 0;font-size:clamp(22px,4vw,30px)}.community-head p,.community-form-head p{margin:5px 0;color:#aebdca;font-size:13px}.community-primary,.community-secondary,.community-close{border-radius:10px;padding:10px 14px;min-height:42px;font-weight:750;cursor:pointer}.community-primary{background:#ff6a00;color:#fff;border:1px solid #ff6a00}.community-secondary,.community-close{background:#172638;color:#eaf3fa;border:1px solid #40566b}.community-tabs{display:flex;gap:8px;border-bottom:1px solid #34485a;margin:12px 0;padding-bottom:8px}.community-tabs button{background:transparent;border:1px solid transparent;color:#c8d5e0;border-radius:9px;padding:9px 14px}.community-tabs button[aria-selected=true]{background:#26394c;border-color:#52718a;color:#fff}.community-toolbar{display:flex;gap:12px;align-items:end;margin:14px 0;flex-wrap:wrap}.community-toolbar label,.community-form label{display:flex;flex-direction:column;gap:6px;color:#c8d5e0;font-size:12px;font-weight:700;flex:1;min-width:150px}.community-search{flex:2!important}.community-toolbar input,.community-toolbar select,.community-form input:not([type=checkbox]),.community-form select,.community-form textarea{width:100%;min-height:42px;border:1px solid #40566b;border-radius:9px;background:#101c2a;color:#f5f8fb;padding:10px;font:inherit}.community-form textarea{resize:vertical}.community-status{padding:11px 13px;border:1px solid #34485a;border-radius:10px;background:#142333;color:#c9d7e2;font-size:13px;margin:14px 0}.community-status.is-error{border-color:#a64b43;color:#ffc1b8}.community-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:12px}.community-card{border:1px solid #34485a;border-radius:14px;background:#121f2e;padding:15px;min-width:0}.community-card h3{margin:0 0 5px;font-size:17px}.community-region,.community-description{color:#aebdca;font-size:12px;line-height:1.5}.community-metrics{font-weight:800;color:#7fd8ff;margin:10px 0}.community-difficulty,.community-state{display:inline-block;border:1px solid #40566b;border-radius:99px;padding:4px 8px;color:#dce8f0;font-size:11px;margin:0 5px 8px 0}.community-empty{grid-column:1/-1;border:1px dashed #40566b;border-radius:12px;padding:24px;text-align:center;color:#b8c7d4}.community-form,.community-detail{margin-top:16px;padding:18px;border:1px solid #40566b;border-radius:14px;background:#111e2c}.community-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.community-form .wide{grid-column:1/-1}.community-check{flex-direction:row!important;align-items:center;gap:9px!important}.community-check input{width:18px;height:18px;accent-color:#ff6a00}.community-hint{margin:0;color:#aebdca;font-size:12px;line-height:1.5}.community-form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.community-detail h3{font-size:23px}.community-detail p{color:#c6d3df;line-height:1.6}@media(max-width:620px){.community-head,.community-form-head{flex-direction:column}.community-primary{width:100%}.community-form-grid{grid-template-columns:1fr}.community-form .wide{grid-column:auto}.community-toolbar{display:grid;grid-template-columns:1fr}.community-form-actions{flex-direction:column-reverse}.community-form-actions button{width:100%}}
`;document.head.append(style);}
function init(){shell();styles();if(typeof switchTab==='function'&&!window.__northboundCommunityWrapped){const original=switchTab;window.switchTab=function(name){if(name==='community'){show();return;}return original(name);};window.__northboundCommunityWrapped=true;} }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
