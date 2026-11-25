/* NORTHBOUND Community MVP UI – additive module. */
(()=>{'use strict';
const TABLE='community_trails',ASSETS='community_trail_assets',BUCKET='community-trail-assets';
const $=(id,root=document)=>root.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtDistance=m=>Number.isFinite(Number(m))?(Number(m)/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km':'—';
const fmtHm=m=>Number.isFinite(Number(m))?Math.round(Number(m)).toLocaleString('de-DE')+' hm':'—';
function parseGpxText(xml){
 if(typeof xml!=='string'||!/<(?:\w+:)?(?:gpx|trk|rte)\b/i.test(xml))throw new Error('Die Datei enthält kein gültiges GPX-Dokument.');
 const points=[],re=/<(?:[\w.-]+:)?(?:trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:trkpt|rtept)\s*>/gi;let match;
 while((match=re.exec(xml))){const lat=Number((match[1].match(/\blat=["']([^"']+)["']/i)||[])[1]),lon=Number((match[1].match(/\blon=["']([^"']+)["']/i)||[])[1]);const em=match[2].match(/<(?:[\w.-]+:)?ele\b[^>]*>\s*(-?\d+(?:\.\d+)?)\s*<\/(?:[\w.-]+:)?ele\s*>/i);const ele=em?Number(em[1]):null;if(Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)points.push({lat,lon,ele:Number.isFinite(ele)?ele:null});}
 if(points.length<2)throw new Error('Die GPX-Datei enthält weniger als zwei gültige Streckenpunkte.');
 const rad=v=>v*Math.PI/180,haversine=(a,b)=>{const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
 let distance=0,ascent=0,descent=0,min=Infinity,max=-Infinity;const profile=[];
 points.forEach((p,i)=>{if(i)distance+=haversine(points[i-1],p);if(p.ele!==null){min=Math.min(min,p.ele);max=Math.max(max,p.ele);if(i&&points[i-1].ele!==null){const delta=p.ele-points[i-1].ele;if(delta>0)ascent+=delta;else descent-=delta;}profile.push({distance,elevation:p.ele});}});
 return {points,distance_m:Math.round(distance),ascent_m:Math.round(ascent),descent_m:Math.round(descent),min_elevation_m:Number.isFinite(min)?Math.round(min):null,max_elevation_m:Number.isFinite(max)?Math.round(max):null,profile};
}
function renderGpxVisuals(container,stats){
 const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el;};
 const addFigure=(title,svg)=>{const figure=document.createElement('figure');figure.className='community-gpx-figure';const caption=document.createElement('figcaption');caption.textContent=title;figure.append(svg,caption);container.append(figure);};
 if(stats.profile.length>=2){
  const vals=stats.profile,lo=Math.min(...vals.map(p=>p.elevation)),hi=Math.max(...vals.map(p=>p.elevation)),span=Math.max(1,hi-lo),end=Math.max(1,stats.distance_m),left=38,right=288,top=14,bottom=108;
  const x=p=>left+(p.distance/end)*(right-left),y=p=>bottom-((p.elevation-lo)/span)*(bottom-top);
  const stride=Math.max(1,Math.ceil(vals.length/1200)),sampled=vals.filter((p,i)=>i%stride===0||i===vals.length-1);
  const svg=make('svg',{viewBox:'0 0 300 145',role:'img','aria-label':'Höhenprofil mit Entfernungs- und Höhenachse'});
  for(let i=0;i<=3;i++){const yy=top+(bottom-top)*i/3,alt=hi-(hi-lo)*i/3;svg.append(make('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#34485a','stroke-width':.7,'stroke-dasharray':'2 3'}));const label=make('text',{x:left-5,y:yy+3,fill:'#b8c7d4','font-size':8,'text-anchor':'end'});label.textContent=Math.round(alt)+' m';svg.append(label);}
  const coords=sampled.map(p=>x(p).toFixed(1)+','+y(p).toFixed(1)).join(' ');
  svg.append(make('line',{x1:left,y1:bottom,x2:right,y2:bottom,stroke:'#8296a8','stroke-width':1}),make('polyline',{points:coords,fill:'none',stroke:'#ff8a36','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
  [0,.5,1].forEach((fraction,i)=>{const label=make('text',{x:left+(right-left)*fraction,y:124,fill:'#b8c7d4','font-size':8,'text-anchor':i===0?'start':i===2?'end':'middle'});label.textContent=(end/1000*fraction).toLocaleString('de-DE',{maximumFractionDigits:1})+' km';svg.append(label);});
  addFigure('Höhenprofil · Entfernung und Höhe',svg);
 }
 const route=stats.points;if(route.length>=2){
  const lats=route.map(p=>p.lat),lons=route.map(p=>p.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons),dx=Math.max(.000001,maxLon-minLon),dy=Math.max(.000001,maxLat-minLat),stride=Math.max(1,Math.ceil(route.length/2500)),sampled=route.filter((p,i)=>i%stride===0||i===route.length-1);
  const coords=sampled.map(p=>(12+(p.lon-minLon)/dx*276).toFixed(1)+','+(108-(p.lat-minLat)/dy*96).toFixed(1)).join(' ');
  const svg=make('svg',{viewBox:'0 0 300 124',role:'img','aria-label':'Schematische Streckenlinie ohne Kartenhintergrund'});
  svg.append(make('polyline',{points:coords,fill:'none',stroke:'#7fd8ff','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
  svg.append(make('circle',{cx:12+(route[0].lon-minLon)/dx*276,cy:108-(route[0].lat-minLat)/dy*96,r:4,fill:'#61d095'}),make('circle',{cx:12+(route.at(-1).lon-minLon)/dx*276,cy:108-(route.at(-1).lat-minLat)/dy*96,r:4,fill:'#ff8a36'}));
  addFigure('Streckenverlauf · schematische Vorschau',svg);
 }
}
function renderGpxMetrics(container,stats){
 container.setAttribute('aria-label','GPX-Streckenkennzahlen');
 const values=[['Distanz',fmtDistance(stats.distance_m)],['Aufstieg',fmtHm(stats.ascent_m)],['Abstieg',fmtHm(stats.descent_m)],['Höchster Punkt',stats.max_elevation_m===null?'—':stats.max_elevation_m+' m'],['Tiefster Punkt',stats.min_elevation_m===null?'—':stats.min_elevation_m+' m']];
 values.forEach(([label,value])=>{const item=document.createElement('div');item.className='community-gpx-metric';const strong=document.createElement('strong');strong.textContent=value;const caption=document.createElement('span');caption.textContent=label;item.append(strong,caption);container.append(item);});
}
async function loadTrailCardPreviews(rows){
 if(!rows.length||!client())return;
 const visible=rows.slice(0,24),ids=visible.map(t=>t.id);
 try{
  const c=client(),{data,error}=await c.from(ASSETS).select('id,trail_id,asset_kind,storage_path,created_at').in('trail_id',ids).order('created_at',{ascending:false});
  if(error)throw error;
  const byTrail=new Map();
  (data||[]).forEach(asset=>{if(!byTrail.has(asset.trail_id))byTrail.set(asset.trail_id,[]);byTrail.get(asset.trail_id).push(asset);});
  for(const t of visible){
   const card=Array.from(document.querySelectorAll('[data-community-card-id]')).find(el=>el.dataset.communityCardId===t.id);
   if(!card)continue;
   const assets=byTrail.get(t.id)||[],imageAsset=assets.find(a=>a.asset_kind==='image');
   const addCoverFallback=()=>{if(card.querySelector('.community-card-cover,.community-card-cover-fallback'))return;const cover=document.createElement('div');cover.className='community-card-cover-fallback';cover.setAttribute('role','img');cover.setAttribute('aria-label','Noch kein Streckenfoto für '+t.title);cover.innerHTML='<svg viewBox="0 0 640 240" aria-hidden="true" focusable="false"><defs><linearGradient id="nbTrailSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#203d52"/><stop offset="1" stop-color="#0b1724"/></linearGradient></defs><path d="M0 0H640V240H0Z" fill="url(#nbTrailSky)"/><path d="M0 190 150 64 240 150 350 42 520 190 640 104V240H0Z" fill="#29495b"/><path d="m170 240 180-198 150 198Z" fill="#385d6c"/><path d="m260 142 90-100 75 99-45-18-29 22-30-19-27 23Z" fill="#9cb5bd" opacity=".72"/><path d="M0 213c120-28 210-10 320 4s210-14 320-35v58H0Z" fill="#142c3b"/><path d="M65 207c90-35 150-22 226-3s145 13 250-25" fill="none" stroke="#ff9b50" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 10"/></svg><span>Streckenfoto folgt</span>';card.insertBefore(cover,card.firstChild);};
   if(imageAsset){try{const {data:signed,error:signError}=await c.storage.from(BUCKET).createSignedUrl(imageAsset.storage_path,180);if(!signError&&signed?.signedUrl){const cover=document.createElement('img');cover.className='community-card-cover';cover.src=signed.signedUrl;cover.alt='Streckenfoto: '+t.title;cover.loading='lazy';cover.decoding='async';cover.addEventListener('error',addCoverFallback,{once:true});card.insertBefore(cover,card.firstChild);}else addCoverFallback();}catch(_){addCoverFallback();}}else addCoverFallback();
   for(const asset of assets.filter(a=>a.asset_kind==='gpx')){
    try{
     const {data:signed,error:signError}=await c.storage.from(BUCKET).createSignedUrl(asset.storage_path,180);if(signError||!signed?.signedUrl)continue;
     const response=await fetch(signed.signedUrl);if(!response.ok)continue;const stats=parseGpxText(await response.text());if(stats.points.length<2)continue;
     const preview=document.createElement('div');preview.className='community-card-previews';preview.setAttribute('aria-label','Streckenvorschau und Höhenprofil');renderGpxVisuals(preview,stats);
     const figures=Array.from(preview.children);if(figures.length===2){figures[0].classList.add('community-preview-elevation');figures[1].classList.add('community-preview-route');}
     const action=card.querySelector('button');card.insertBefore(preview,action||null);break;
    }catch(_){continue;}
   }
  }
 }catch(error){console.warn('Trail-Kartenvorschauen konnten nicht geladen werden.',error);}
}
let leafletLoader=null,communityMapSequence=0,communityDiscoveryMap=null,communityDiscoveryMarkers=null,communityDiscoveryRenderToken=0;
function loadLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(leafletLoader)return leafletLoader;
 leafletLoader=new Promise((resolve,reject)=>{
  if(!document.getElementById('northboundLeafletCss')){const link=document.createElement('link');link.id='northboundLeafletCss';link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(link);}
  const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;
  script.onload=()=>window.L?resolve(window.L):reject(new Error('Kartenbibliothek wurde nicht initialisiert.'));
  script.onerror=()=>reject(new Error('Kartenbibliothek konnte nicht geladen werden.'));
  document.head.append(script);
 });
 return leafletLoader;
}
async function renderGpxMap(container,stats){
 const figure=document.createElement('figure');figure.className='community-gpx-map-figure';
 const map=document.createElement('div');map.className='community-gpx-map';map.id='community-gpx-map-'+(++communityMapSequence);map.setAttribute('role','region');map.setAttribute('aria-label','Interaktive Karte des GPX-Streckenverlaufs');
 const controls=document.createElement('div');controls.className='community-map-controls';const expand=document.createElement('button');expand.type='button';expand.className='community-secondary';expand.textContent='Karte vergrößern';expand.setAttribute('aria-expanded','false');controls.append(expand);
 const caption=document.createElement('figcaption');caption.textContent='Streckenkarte · Start grün, Ziel orange · Kartendaten © OpenStreetMap';
 figure.append(controls,map,caption);container.append(figure);expand.addEventListener('click',()=>{const expanded=figure.classList.toggle('is-expanded');expand.textContent=expanded?'Karte verkleinern':'Karte vergrößern';expand.setAttribute('aria-expanded',String(expanded));figure.querySelector('.community-gpx-map')?.dispatchEvent(new Event('northbound-map-resize'));});
 try{
  const L=await loadLeaflet();if(!map.isConnected)return;
  const points=stats.points.map(p=>[p.lat,p.lon]),bounds=L.latLngBounds(points);
  const view=L.map(map,{scrollWheelZoom:false,keyboard:true,zoomControl:true}).fitBounds(bounds,{padding:[18,18]});
  map.addEventListener('northbound-map-resize',()=>setTimeout(()=>view.invalidateSize(),100));
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(view);
  L.polyline(points,{color:'#ff8a36',weight:4,opacity:.95}).addTo(view);
  L.circleMarker(points[0],{radius:6,color:'#0b5131',fillColor:'#61d095',fillOpacity:1}).bindTooltip('Start').addTo(view);
  L.circleMarker(points[points.length-1],{radius:6,color:'#8b3f17',fillColor:'#ff8a36',fillOpacity:1}).bindTooltip('Ziel').addTo(view);
  setTimeout(()=>view.invalidateSize(),80);
 }catch(error){const message=document.createElement('p');message.className='community-hint';message.textContent='Kartenansicht nicht verfügbar: '+error.message+' Die schematische Streckenansicht bleibt sichtbar.';figure.append(message);}
}

async function renderDiscoveryMap(rows){
 const token=++communityDiscoveryRenderToken;const figure=$('communityDiscoveryMap');if(!figure)return;
 const locations=active==='discover'?rows.filter(t=>t.map_location_enabled===true&&Number.isFinite(Number(t.start_latitude))&&Number.isFinite(Number(t.start_longitude))):[];
 if(!locations.length){figure.hidden=true;communitySelectedTrailId=null;communityDiscoveryMarkersByTrail.clear();if(communityDiscoveryMap){communityDiscoveryMap.remove();communityDiscoveryMap=null;communityDiscoveryMarkers=null;}return;}
 figure.hidden=false;
 const mapElement=$('communityDiscoveryMapCanvas');if(!mapElement)return;
 try{
  const L=await loadLeaflet();if(token!==communityDiscoveryRenderToken||!mapElement.isConnected||active!=='discover')return;
  if(!communityDiscoveryMap){communityDiscoveryMap=L.map(mapElement,{scrollWheelZoom:false,zoomControl:true}).setView([locations[0].start_latitude,locations[0].start_longitude],8);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(communityDiscoveryMap);communityDiscoveryMarkers=L.layerGroup().addTo(communityDiscoveryMap);}
  communityDiscoveryMarkers.clearLayers();communityDiscoveryMarkersByTrail.clear();const bounds=[];
  locations.forEach(t=>{const point=[Number(t.start_latitude),Number(t.start_longitude)];bounds.push(point);const marker=L.marker(point).addTo(communityDiscoveryMarkers);communityDiscoveryMarkersByTrail.set(t.id,marker);marker.bindPopup('<strong>'+esc(t.title)+'</strong><br>'+esc([t.region_name,t.country_code].filter(Boolean).join(' · ')||'Region nicht angegeben')+'<br>'+esc(fmtDistance(t.distance_m))+' · '+esc(fmtHm(t.ascent_m))+'<br><button type="button" class="community-map-open" data-community-map-trail="'+esc(t.id)+'">Trail ansehen</button>');marker.on('popupopen',event=>{selectDiscoveryTrail(t.id,false);const button=event.popup.getElement()?.querySelector('[data-community-map-trail]');button?.addEventListener('click',()=>{const selected=trails.find(item=>item.id===button.dataset.communityMapTrail);if(selected)detail(selected);});});});
  if(bounds.length===1)communityDiscoveryMap.setView(bounds[0],11);else communityDiscoveryMap.fitBounds(L.latLngBounds(bounds),{padding:[24,24],maxZoom:11});
  setTimeout(()=>communityDiscoveryMap?.invalidateSize(),80);
 }catch(error){figure.hidden=false;const note=$('communityDiscoveryMapStatus');if(note)note.textContent='Karte nicht verfügbar: '+error.message;}
}

function selectDiscoveryTrail(id,focusMap=false,scrollCard=true){
 communitySelectedTrailId=id;
 document.querySelectorAll('[data-community-card-id]').forEach(card=>{const selected=card.dataset.communityCardId===id;card.classList.toggle('is-map-selected',selected);if(selected)card.setAttribute('aria-current','true');else card.removeAttribute('aria-current');});
 communityDiscoveryMarkersByTrail.forEach((item,key)=>{item.setZIndexOffset(key===id?1000:0);item.setOpacity(key===id?1:.72);});
 const marker=communityDiscoveryMarkersByTrail.get(id);
 if(marker&&communityDiscoveryMap&&focusMap){communityDiscoveryMap.panTo(marker.getLatLng(),{animate:true});marker.openPopup();}
 if(!focusMap&&scrollCard){const card=Array.from(document.querySelectorAll('[data-community-card-id]')).find(item=>item.dataset.communityCardId===id);card?.scrollIntoView({behavior:'smooth',block:'nearest'});}
}

async function communityUploadMime(file,kind){
 const ext=(file.name.split('.').pop()||'').toLowerCase(),bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 if(kind==='gpx'){if(ext!=='gpx')throw new Error('Die Streckendatei muss die Endung .gpx haben.');return 'application/gpx+xml';}
 let mime=ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='png'?'image/png':ext==='webp'?'image/webp':'';
 if(!mime)throw new Error('Nur JPG-, PNG- und WebP-Bilder sind erlaubt: '+file.name);
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
 const webp=bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
 if(!(mime==='image/jpeg'&&jpeg)&&!(mime==='image/png'&&png)&&!(mime==='image/webp'&&webp))throw new Error('Der Bildinhalt passt nicht zur Dateiendung: '+file.name);
 return mime;
}
window.NorthboundCommunityGPX={parse:parseGpxText};

const labels={easy:'Leicht',moderate:'Mittel',difficult:'Schwer',technical:'Technisch',expert:'Experte'};
let active='discover',trails=[],busy=false,editingTrail=null,communitySelectedTrailId=null,communityDiscoveryMarkersByTrail=new Map();
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
 <div class="community-toolbar" id="communityFilters"><label class="community-search">Suche<input id="communitySearch" type="search" placeholder="Trail, Region oder Beschreibung"></label><label>Region<input id="communityRegion" type="search" placeholder="z. B. Chiemgau"></label><label>Schwierigkeit<select id="communityDifficulty"><option value="">Alle</option><option value="easy">Leicht</option><option value="moderate">Mittel</option><option value="difficult">Schwer</option><option value="technical">Technisch</option><option value="expert">Experte</option></select></label><label>Distanz ab (km)<input id="communityMinDistance" type="number" min="0" step="1" placeholder="Min."></label><label>Distanz bis (km)<input id="communityMaxDistance" type="number" min="0" step="1" placeholder="Max."></label><label>Aufstieg bis (hm)<input id="communityMaxAscent" type="number" min="0" step="100" placeholder="Max."></label><label>Untergrund<input id="communitySurface" type="search" placeholder="z. B. Fels, Wald"></label><label>Sortierung<select id="communitySort"><option value="recent">Neueste zuerst</option><option value="distance-asc">Distanz aufsteigend</option><option value="distance-desc">Distanz absteigend</option><option value="ascent-desc">Meiste Höhenmeter</option><option value="title">Name A–Z</option></select></label><button type="button" class="community-secondary" id="communityResetFilters">Filter zurücksetzen</button></div>
 <div id="communityStatus" class="community-status" role="status" aria-live="polite">Community wird geladen …</div><section id="communityDiscoveryMap" class="community-discovery-map" hidden><div class="community-map-heading"><strong>Trails auf der Karte</strong><span id="communityDiscoveryMapStatus">Nur freigegebene Startpunkte werden angezeigt.</span></div><div id="communityDiscoveryMapCanvas" class="community-discovery-map-canvas" role="region" aria-label="Karte öffentlicher Community-Trails"></div><p class="community-hint">Kartenpunkte erscheinen nur, wenn Trail-Ersteller den Startpunkt ausdrücklich für die öffentliche Karte freigeben. Kartendaten © OpenStreetMap.</p></section><div id="communityTrailList" class="community-grid"></div>
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
   <label class="wide">Bilder hinzufügen (JPG, PNG, WebP; max. 25 MB je Datei)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
   <label class="wide" id="communityGpxUploadLabel">GPX-Datei (optional; max. 25 MB)<input name="gpx" type="file" accept=".gpx,*/*"></label>
   <section class="community-existing-assets wide" id="communityExistingAssets" hidden aria-label="Vorhandene Dateien"><h4>Vorhandene Dateien</h4><div class="community-existing-assets-list"></div><p class="community-hint">Du kannst Dateien einzeln entfernen. Eine neue GPX-Datei ersetzt die bisherige erst nach erfolgreichem Upload.</p></section>
   <label class="community-check"><input name="visibility" type="checkbox"> Trail öffentlich veröffentlichen</label>
   <label class="community-check"><input name="gpx_download_enabled" type="checkbox"> GPX-Download erlauben</label>
   <label class="community-check wide"><input name="map_location_enabled" type="checkbox"> Startpunkt auf der öffentlichen Community-Karte anzeigen</label>
   <p class="community-hint wide">Der Karten-Startpunkt wird nur bei öffentlichen Trails und nur mit deiner ausdrücklichen Freigabe gespeichert. Ohne Freigabe erscheint kein Kartenpunkt.</p>
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
 ['communitySearch','communityRegion','communityMinDistance','communityMaxDistance','communityMaxAscent','communitySurface'].forEach(id=>$(id).addEventListener('input',render));$('communityDifficulty').addEventListener('change',render);$('communitySort').addEventListener('change',render);$('communityResetFilters').addEventListener('click',()=>{['communitySearch','communityRegion','communityMinDistance','communityMaxDistance','communityMaxAscent','communitySurface'].forEach(id=>$(id).value='');$('communityDifficulty').value='';$('communitySort').value='recent';render();});
}
function show(){shell();const panel=root();if(!panel)return;document.querySelectorAll('.tab-panel').forEach(el=>el.hidden=el!==panel);document.querySelectorAll('.more-nav-item[aria-pressed]').forEach(el=>el.setAttribute('aria-pressed','false'));$('communityTabButton')?.setAttribute('aria-pressed','true');$('appMenuDropdown')&&( $('appMenuDropdown').hidden=true);load();}
function openForm(){if(!client()){setStatus('Bitte zuerst anmelden. Die Community-Datenbank ist noch nicht mit deinem Konto verfügbar.',true);return;}editingTrail=null;$('communityTrailForm').reset();$('communityTrailForm').querySelector('h3').textContent='Trail hinzufügen';$('communitySaveTrail').textContent='Trail speichern';$('communityExistingAssets').hidden=true;$('communityGpxUploadLabel').firstChild.textContent='GPX-Datei (optional; max. 25 MB)';$('communityDetail').hidden=true;$('communityTrailList').hidden=true;$('communityTrailForm').hidden=false;}
function closeForm(){editingTrail=null;$('communityTrailForm').hidden=true;$('communityTrailList').hidden=false;}
function editTrail(t){if(!client()||t.owner_id!==cloudUser.id){setStatus('Nur der Ersteller kann diesen Trail bearbeiten.',true);return;}editingTrail=t;const f=$('communityTrailForm');f.reset();for(const [name,value] of Object.entries({title:t.title,description:t.description||'',region_name:t.region_name||'',country_code:t.country_code||'',distance_km:t.distance_m==null?'':Number(t.distance_m)/1000,ascent_m:t.ascent_m??'',descent_m:t.descent_m??'',difficulty:t.difficulty||'',surface_summary:t.surface_summary||'',start_location_label:t.start_location_label||''})){if(f.elements[name])f.elements[name].value=value;}f.elements.visibility.checked=t.visibility==='public';f.elements.gpx_download_enabled.checked=!!t.gpx_download_enabled;f.elements.map_location_enabled.checked=!!t.map_location_enabled;f.querySelector('h3').textContent='Trail bearbeiten';$('communitySaveTrail').textContent='Änderungen speichern';$('communityGpxUploadLabel').firstChild.textContent='GPX-Datei ersetzen (optional; max. 25 MB)';$('communityDetail').hidden=true;$('communityTrailList').hidden=true;f.hidden=false;renderEditAssets(t);}
async function renderEditAssets(t){
 const section=$('communityExistingAssets'),list=section.querySelector('.community-existing-assets-list');section.hidden=false;list.replaceChildren();
 const c=client();if(!c||t.owner_id!==cloudUser.id){section.hidden=true;return;}
 const {data,error}=await c.from(ASSETS).select('id,asset_kind,storage_path,content_type,file_size,created_at').eq('trail_id',t.id).eq('owner_id',cloudUser.id).order('created_at',{ascending:false});
 if(error){const p=document.createElement('p');p.className='community-hint';p.textContent='Dateiliste konnte nicht geladen werden: '+error.message;list.append(p);return;}
 if(!data?.length){const p=document.createElement('p');p.className='community-hint';p.textContent='Noch keine Dateien hinterlegt.';list.append(p);return;}
 for(const asset of data){
  const row=document.createElement('div');row.className='community-existing-asset';
  const info=document.createElement('div');info.className='community-existing-asset-info';
  const name=document.createElement('strong');name.textContent=asset.asset_kind==='gpx'?'GPX-Strecke':asset.asset_kind==='elevation_profile'?'Höhenprofil':'Trail-Bild';
  const meta=document.createElement('small');meta.textContent=(asset.content_type||'Datei')+' · '+(asset.file_size?Math.max(1,Math.round(asset.file_size/1024))+' KB':'Größe unbekannt');
  info.append(name,meta);
  const remove=document.createElement('button');remove.type='button';remove.className='community-secondary';remove.textContent='Entfernen';remove.addEventListener('click',async()=>{
   if(!confirm((asset.asset_kind==='gpx'?'GPX-Datei':'Bild')+' wirklich entfernen?'))return;
   remove.disabled=true;remove.textContent='Entferne …';
   try{
    const {error:storageError}=await c.storage.from(BUCKET).remove([asset.storage_path]);if(storageError)throw storageError;
    const {error:rowError}=await c.from(ASSETS).delete().eq('id',asset.id).eq('trail_id',t.id).eq('owner_id',cloudUser.id);if(rowError)throw rowError;
    if(asset.asset_kind==='gpx'){const {error:trailError}=await c.from(TABLE).update({map_location_enabled:false,start_latitude:null,start_longitude:null,gpx_download_enabled:false}).eq('id',t.id).eq('owner_id',cloudUser.id);if(trailError)throw trailError;}
    setStatus('Datei entfernt.');await renderEditAssets(t);
   }catch(err){setStatus('Datei konnte nicht entfernt werden: '+err.message,true);remove.disabled=false;remove.textContent='Erneut versuchen';}
  });
  row.append(info,remove);list.append(row);
 }
}
async function deleteTrail(t){if(!client()||t.owner_id!==cloudUser.id){setStatus('Nur der Ersteller kann diesen Trail löschen.',true);return;}if(!confirm('Trail „'+t.title+'“ wirklich dauerhaft löschen? Bilder und GPX-Dateien werden ebenfalls entfernt.'))return;setStatus('Trail wird gelöscht …');try{const c=client();const {data:assets,error:assetError}=await c.from(ASSETS).select('storage_path').eq('trail_id',t.id).eq('owner_id',cloudUser.id);if(assetError)throw assetError;const paths=(assets||[]).map(a=>a.storage_path);if(paths.length){const {error:storageError}=await c.storage.from(BUCKET).remove(paths);if(storageError)throw storageError;}const {error}=await c.from(TABLE).delete().eq('id',t.id).eq('owner_id',cloudUser.id);if(error)throw error;$('communityDetail').hidden=true;$('communityTrailList').hidden=false;setStatus('Trail und zugehörige Dateien wurden gelöscht.');await load();}catch(error){setStatus('Trail konnte nicht vollständig gelöscht werden: '+error.message,true);}}
async function load(){
 const c=client();if(!c){setStatus('Bitte anmelden, um die Trail Community zu nutzen. Öffentliche Trails sind nach Freischaltung der Community-Datenbank sichtbar.');$('communityTrailList').replaceChildren();return;}
 setStatus('Lade Trails …');
 try{
  let q=c.from(TABLE).select('id,owner_id,title,description,visibility,publication_status,distance_m,ascent_m,descent_m,difficulty,surface_summary,start_location_label,region_name,country_code,gpx_download_enabled,map_location_enabled,start_latitude,start_longitude,created_at,published_at').order('updated_at',{ascending:false}).limit(100);
  q=active==='mine'?q.eq('owner_id',cloudUser.id):q.eq('visibility','public').eq('publication_status','published');
  const {data,error}=await q;if(error)throw error;trails=data||[];render();setStatus(trails.length?trails.length+' Trail(s) gefunden.':active==='mine'?'Du hast noch keine eigenen Trails.':'Noch keine öffentlichen Trails vorhanden.'); 
 }catch(error){trails=[];render();setStatus(/relation .* does not exist|schema cache/i.test(error.message||'')?'Die Community-Datenbank ist noch nicht freigeschaltet. Die Migration wartet auf die separate Freigabe.':'Trails konnten nicht geladen werden: '+error.message,true);}
}
function render(){
 const list=$('communityTrailList');if(!list)return;$('communityResultCount')?.remove();
 const value=id=>($(id)?.value||'').trim(),term=value('communitySearch').toLocaleLowerCase('de-DE'),region=value('communityRegion').toLocaleLowerCase('de-DE'),surface=value('communitySurface').toLocaleLowerCase('de-DE'),difficulty=value('communityDifficulty'),minDistance=value('communityMinDistance')===''?null:Number(value('communityMinDistance'))*1000,maxDistance=value('communityMaxDistance')===''?null:Number(value('communityMaxDistance'))*1000,maxAscent=value('communityMaxAscent')===''?null:Number(value('communityMaxAscent')),sort=value('communitySort')||'recent';
 let rows=trails.filter(t=>{
  const matchesTerm=!term||[t.title,t.description,t.region_name,t.country_code,t.surface_summary].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(term));
  const matchesRegion=!region||[t.region_name,t.country_code].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(region));
  const matchesSurface=!surface||String(t.surface_summary||'').toLocaleLowerCase('de-DE').includes(surface);
  const distance=t.distance_m===null?null:Number(t.distance_m),ascent=t.ascent_m===null?null:Number(t.ascent_m);
  return (!difficulty||t.difficulty===difficulty)&&matchesTerm&&matchesRegion&&matchesSurface&&(minDistance===null||(distance!==null&&distance>=minDistance))&&(maxDistance===null||(distance!==null&&distance<=maxDistance))&&(maxAscent===null||(ascent!==null&&ascent<=maxAscent));
 });
 rows.sort((a,b)=>{if(sort==='distance-asc')return (a.distance_m??Infinity)-(b.distance_m??Infinity);if(sort==='distance-desc')return (b.distance_m??-Infinity)-(a.distance_m??-Infinity);if(sort==='ascent-desc')return (b.ascent_m??-Infinity)-(a.ascent_m??-Infinity);if(sort==='title')return a.title.localeCompare(b.title,'de');return new Date(b.created_at||0)-new Date(a.created_at||0);});
 if(communitySelectedTrailId&&!rows.some(t=>t.id===communitySelectedTrailId))communitySelectedTrailId=null;
 renderDiscoveryMap(rows);list.replaceChildren();
 rows.forEach(t=>{const card=document.createElement('article');card.className='community-card';card.dataset.communityCardId=t.id;const title=document.createElement('h3');title.textContent=t.title;const regionEl=document.createElement('p');regionEl.className='community-region';regionEl.textContent=[t.region_name,t.country_code].filter(Boolean).join(' · ')||'Region nicht angegeben';const metrics=document.createElement('div');metrics.className='community-metrics';metrics.textContent=fmtDistance(t.distance_m)+'  ·  '+fmtHm(t.ascent_m);const difficultyEl=document.createElement('span');difficultyEl.className='community-difficulty';difficultyEl.textContent=labels[t.difficulty]||'Schwierigkeit offen';const desc=document.createElement('p');desc.textContent=t.description||'Keine Beschreibung vorhanden.';desc.className='community-description';const surfaceEl=document.createElement('p');surfaceEl.className='community-region';surfaceEl.textContent=t.surface_summary?'Untergrund: '+t.surface_summary:'';const action=document.createElement('button');action.type='button';action.className='community-secondary';action.textContent=active==='mine'?'Details / verwalten':'Trail ansehen';action.addEventListener('click',()=>detail(t));card.append(title,regionEl,metrics,difficultyEl,desc);if(t.surface_summary)card.append(surfaceEl);card.append(action);if(active==='discover'&&t.map_location_enabled===true){const mapAction=document.createElement('button');mapAction.type='button';mapAction.className='community-secondary community-show-on-map';mapAction.textContent='Auf Karte zeigen';mapAction.addEventListener('click',()=>selectDiscoveryTrail(t.id,true));card.append(mapAction);}if(active==='mine'){const status=document.createElement('span');status.className='community-state';status.textContent=t.visibility==='private'?'Privat':t.publication_status==='draft'?'Entwurf':'Öffentlich';card.append(status);}list.append(card);});
 loadTrailCardPreviews(rows);
 if(!rows.length){const empty=document.createElement('div');empty.className='community-empty';empty.textContent=active==='mine'?'Deine Trails erscheinen hier. Lege deinen ersten Trail an.':'Keine Trails passen zu deiner Suche. Passe die Filter an oder setze die Filter zurück.';list.append(empty);}
 const count=document.createElement('p');count.id='communityResultCount';count.className='community-hint';count.textContent=rows.length+' von '+trails.length+' Trails angezeigt';list.before(count);if(communitySelectedTrailId)selectDiscoveryTrail(communitySelectedTrailId,false,false);
}
function openCommunityLightbox(items,index=0){
 let current=Math.max(0,Math.min(index,items.length-1));
 const overlay=document.createElement('div');overlay.className='community-lightbox';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Trail-Bildansicht');
 const image=document.createElement('img');image.className='community-lightbox-image';
 const caption=document.createElement('p');caption.className='community-lightbox-caption';
 const close=document.createElement('button');close.type='button';close.className='community-lightbox-close';close.textContent='Schließen ✕';close.setAttribute('aria-label','Bildansicht schließen');
 const previous=document.createElement('button');previous.type='button';previous.className='community-lightbox-prev';previous.textContent='‹';previous.setAttribute('aria-label','Vorheriges Bild');
 const next=document.createElement('button');next.type='button';next.className='community-lightbox-next';next.textContent='›';next.setAttribute('aria-label','Nächstes Bild');
 const count=document.createElement('span');count.className='community-lightbox-count';
 const closeOverlay=()=>{overlay.remove();document.removeEventListener('keydown',onKey);};
 const show=()=>{const item=items[current];image.src=item.src;image.alt=item.alt||'Trail-Bild';caption.textContent=item.caption||'';count.textContent=(current+1)+' / '+items.length;previous.disabled=items.length<2;next.disabled=items.length<2;};
 const onKey=e=>{if(e.key==='Escape')closeOverlay();if(e.key==='ArrowLeft'&&items.length>1){current=(current+items.length-1)%items.length;show();}if(e.key==='ArrowRight'&&items.length>1){current=(current+1)%items.length;show();}};
 close.addEventListener('click',closeOverlay);previous.addEventListener('click',()=>{current=(current+items.length-1)%items.length;show();});next.addEventListener('click',()=>{current=(current+1)%items.length;show();});overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay();});document.addEventListener('keydown',onKey);
 const stage=document.createElement('div');stage.className='community-lightbox-stage';stage.append(previous,image,next);
 const footer=document.createElement('div');footer.className='community-lightbox-footer';footer.append(caption,count);
 const panel=document.createElement('div');panel.className='community-lightbox-panel';panel.append(close,stage,footer);overlay.append(panel);document.body.append(overlay);show();close.focus();
}
async function deleteTrailAsset(t,asset,feedback){
 if(!client()||t.owner_id!==cloudUser.id){setStatus('Nur der Ersteller kann Dateien entfernen.',true);return;}
 if(!confirm((asset.asset_kind==='gpx'?'GPX-Datei':'Bild')+' wirklich aus diesem Trail entfernen?'))return;
 feedback.textContent='Datei wird entfernt …';
 try{
  const c=client();
  const {error:storageError}=await c.storage.from(BUCKET).remove([asset.storage_path]);
  if(storageError)throw storageError;
  const {error:rowError}=await c.from(ASSETS).delete().eq('id',asset.id).eq('trail_id',t.id).eq('owner_id',cloudUser.id);
  if(rowError)throw rowError;
  if(asset.asset_kind==='gpx'){
   const {error:trailError}=await c.from(TABLE).update({map_location_enabled:false,start_latitude:null,start_longitude:null,gpx_download_enabled:false}).eq('id',t.id).eq('owner_id',cloudUser.id);
   if(trailError)throw trailError;
  }
  feedback.textContent='Datei wurde entfernt.';
  await load();
  const fresh=trails.find(x=>x.id===t.id);
  if(fresh)await detail(fresh);
 }catch(error){feedback.textContent='Datei konnte nicht entfernt werden: '+error.message;feedback.classList.add('is-error');}
}
async function detail(t){
 const d=$('communityDetail');d._communityNavObserver?.disconnect();d.hidden=false;$('communityTrailList').hidden=true;$('communityTrailForm').hidden=true;d.replaceChildren();
 const back=document.createElement('button');back.type='button';back.className='community-secondary';back.textContent='← Zurück';back.addEventListener('click',()=>{d.hidden=true;$('communityTrailList').hidden=false;});
 const h=document.createElement('h3');h.textContent=t.title;
 const p=document.createElement('p');p.textContent=t.description||'Keine Beschreibung vorhanden.';
 const meta=document.createElement('p');meta.className='community-detail-meta';meta.textContent=[t.region_name,t.country_code,fmtDistance(t.distance_m),fmtHm(t.ascent_m),fmtHm(t.descent_m),labels[t.difficulty]||''].filter(Boolean).join(' · ');
 const statsPanel=document.createElement('div');statsPanel.className='community-gpx-metrics';statsPanel.setAttribute('aria-label','Streckenkennzahlen');
 const routeSection=document.createElement('section');routeSection.className='community-route-section';routeSection.setAttribute('aria-label','Streckenverlauf und Höhenprofil');
 const routeBlock=document.createElement('section');routeBlock.className='community-detail-block community-detail-route';const routeHeading=document.createElement('h4');routeHeading.textContent='Strecke & Höhenprofil';routeBlock.append(routeHeading,statsPanel,routeSection);
 const gallery=document.createElement('div');gallery.className='community-gallery';gallery.setAttribute('aria-label','Trail-Fotogalerie');
 const galleryBlock=document.createElement('section');galleryBlock.className='community-detail-block community-detail-photos';const galleryHeading=document.createElement('h4');galleryHeading.textContent='Streckenfotos';galleryBlock.append(galleryHeading,gallery);
 const files=document.createElement('div');files.className='community-files';
 const filesBlock=document.createElement('section');filesBlock.className='community-detail-block community-detail-files';const filesHeading=document.createElement('h4');filesHeading.textContent='Dateien';filesBlock.append(filesHeading,files);
 const feedback=document.createElement('p');feedback.className='community-status';feedback.textContent='Lade Bilder, GPX und Community-Informationen …';
 d.append(back,h,meta,p,routeBlock,galleryBlock,filesBlock,feedback);
 if(active==='mine'&&t.owner_id===cloudUser.id){const ownerActions=document.createElement('div');ownerActions.className='community-detail-actions';const edit=document.createElement('button');edit.type='button';edit.className='community-primary';edit.textContent='✎ Trail bearbeiten';edit.addEventListener('click',()=>editTrail(t));const remove=document.createElement('button');remove.type='button';remove.className='community-secondary';remove.textContent='Trail löschen';remove.addEventListener('click',()=>deleteTrail(t));const toggle=document.createElement('button');toggle.type='button';toggle.className='community-secondary';toggle.textContent=t.visibility==='public'?'Auf privat setzen':'Öffentlich veröffentlichen';toggle.addEventListener('click',()=>updateVisibility(t));ownerActions.append(edit,remove,toggle);d.append(ownerActions);}
 const c=client();if(!c)return;
 try{
  const [assetResult,reviewResult,commentResult,favoriteResult,myReviewResult]=await Promise.all([
   c.from(ASSETS).select('id,asset_kind,storage_path,content_type,download_enabled,caption,alt_text,sort_order').eq('trail_id',t.id).order('created_at',{ascending:false}).order('sort_order',{ascending:true}),
   c.from('community_trail_reviews').select('rating,review_text,created_at').eq('trail_id',t.id),
   c.from('community_trail_comments').select('id,user_id,body,created_at').eq('trail_id',t.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(30),
   c.from('community_trail_favorites').select('trail_id').eq('trail_id',t.id).eq('user_id',cloudUser.id).maybeSingle(),
   c.from('community_trail_reviews').select('id,rating,review_text').eq('trail_id',t.id).eq('user_id',cloudUser.id).maybeSingle()
  ]);
  for(const result of [assetResult,reviewResult,commentResult,favoriteResult,myReviewResult])if(result.error)throw result.error;
  const assets=assetResult.data||[],images=assets.filter(a=>a.asset_kind==='image'||a.asset_kind==='elevation_profile'),gpxCandidates=assets.filter(a=>a.asset_kind==='gpx');let gpx=null,gpxStats=null,gpxSignedUrl=null;for(const candidate of gpxCandidates){try{const signed=await c.storage.from(BUCKET).createSignedUrl(candidate.storage_path,600);if(signed.error||!signed.data?.signedUrl)continue;const response=await fetch(signed.data.signedUrl);if(!response.ok)continue;const stats=parseGpxText(await response.text());gpx=candidate;gpxSignedUrl=signed.data.signedUrl;gpxStats=stats;break;}catch(_){continue;}}
   if(active==='mine'){
    const mapToggle=document.createElement('button');mapToggle.type='button';mapToggle.className='community-secondary';
    mapToggle.textContent=t.map_location_enabled?'Startpunkt von öffentlicher Karte entfernen':'Startpunkt auf öffentlicher Karte freigeben';
    mapToggle.disabled=t.visibility!=='public'||t.publication_status!=='published';
    mapToggle.title=mapToggle.disabled?'Trail zuerst öffentlich veröffentlichen.':'Die Freigabe zeigt nur den GPX-Startpunkt, nicht die gesamte private Adresse.';
    mapToggle.addEventListener('click',()=>updateMapLocation(t,!t.map_location_enabled,gpx,feedback,mapToggle));d.append(mapToggle);
    if(mapToggle.disabled){const note=document.createElement('p');note.className='community-hint';note.textContent='Für die Kartenfreigabe muss der Trail öffentlich veröffentlicht sein.';d.append(note);}
   }
  const lightboxItems=[];for(const asset of images){const {data,error}=await c.storage.from(BUCKET).createSignedUrl(asset.storage_path,600);if(error)continue;const figure=document.createElement('figure');const img=document.createElement('img');img.src=data.signedUrl;img.alt=asset.alt_text||asset.caption||(asset.asset_kind==='elevation_profile'?'Höhenprofil':'Trail-Bild');img.loading='lazy';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Bild vergrößern: '+img.alt);const item={src:data.signedUrl,alt:img.alt,caption:asset.caption||''};lightboxItems.push(item);const open=()=>openCommunityLightbox(lightboxItems,lightboxItems.length-1);img.addEventListener('click',open);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});figure.append(img);if(asset.caption){const cap=document.createElement('figcaption');cap.textContent=asset.caption;figure.append(cap);}if(active==='mine'&&t.owner_id===cloudUser.id){const remove=document.createElement('button');remove.type='button';remove.className='community-secondary';remove.textContent='Bild entfernen';remove.addEventListener('click',()=>deleteTrailAsset(t,asset,feedback));figure.append(remove);}gallery.append(figure);}
  if(!images.length){galleryBlock.hidden=true;}
  if(gpx&&gpxStats&&gpxSignedUrl){const a=document.createElement('a');a.className='community-secondary community-download';a.href=gpxSignedUrl;a.download='trail-'+t.id+'.gpx';a.rel='noopener';a.textContent='GPX-Datei herunterladen';files.append(a);const stats=gpxStats;renderGpxMetrics(statsPanel,stats);await renderGpxMap(routeSection,stats);renderGpxVisuals(routeSection,stats);if(active==='mine'&&t.owner_id===cloudUser.id){const remove=document.createElement('button');remove.type='button';remove.className='community-secondary';remove.textContent='GPX-Datei entfernen';remove.addEventListener('click',()=>deleteTrailAsset(t,gpx,feedback));files.append(remove);}}else if(gpxCandidates.length){const note=document.createElement('p');note.className='community-hint';note.textContent='GPX-Datei ist registriert, konnte aber nicht geöffnet werden. Bitte die Datei in „Trail bearbeiten“ erneut hochladen.';files.append(note);if(active==='mine'&&t.owner_id===cloudUser.id){const remove=document.createElement('button');remove.type='button';remove.className='community-secondary';remove.textContent='Ungültige GPX-Einträge entfernen';remove.addEventListener('click',async()=>{for(const candidate of gpxCandidates)await deleteTrailAsset(t,candidate,feedback);});files.append(remove);}}
  routeBlock.hidden=!gpx;
  filesBlock.hidden=!files.children.length;
  const reviews=reviewResult.data||[],avg=reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:0;
  const reviewSection=document.createElement('section');reviewSection.className='community-feedback-section';
  const writtenReviews=(reviewResult.data||[]).filter(r=>String(r.review_text||'').trim());
  writtenReviews.forEach(r=>{const item=document.createElement('article');item.className='community-comment';const score=document.createElement('strong');score.textContent='★ '+r.rating+'/5';const text=document.createElement('p');text.textContent=r.review_text;const date=document.createElement('small');date.textContent=new Date(r.created_at).toLocaleDateString('de-DE');item.append(score,text,date);reviewSection.append(item);});
const reviewTitle=document.createElement('h4');reviewTitle.textContent='Bewertungen';const average=document.createElement('p');average.textContent=reviews.length?('★ '+avg.toLocaleString('de-DE',{maximumFractionDigits:1})+'/5 · '+reviews.length+' Bewertung(en)'):'Noch keine Bewertungen';reviewSection.append(reviewTitle,average);
  const reviewForm=document.createElement('form');reviewForm.className='community-inline-form';const stars=document.createElement('select');stars.name='rating';stars.setAttribute('aria-label','Deine Bewertung');for(let n=5;n>=1;n--){const option=document.createElement('option');option.value=String(n);option.textContent=n+' Sterne';if(myReviewResult.data?.rating===n)option.selected=true;stars.append(option);}const reviewText=document.createElement('textarea');reviewText.name='review_text';reviewText.maxLength=3000;reviewText.rows=2;reviewText.placeholder='Dein Eindruck (optional)';reviewText.value=myReviewResult.data?.review_text||'';const saveReview=document.createElement('button');saveReview.type='submit';saveReview.className='community-secondary';saveReview.textContent='Bewertung speichern';reviewForm.append(stars,reviewText,saveReview);reviewForm.addEventListener('submit',async e=>{e.preventDefault();const payload={trail_id:t.id,user_id:cloudUser.id,rating:Number(stars.value),review_text:reviewText.value.trim()||null};const result=await c.from('community_trail_reviews').upsert(payload,{onConflict:'trail_id,user_id'});if(result.error){feedback.textContent='Bewertung konnte nicht gespeichert werden: '+result.error.message;return;}detail(t);});reviewSection.append(reviewForm);
  if(t.visibility==='public'&&t.publication_status==='published'){
  const commentsSection=document.createElement('section');commentsSection.className='community-feedback-section';const commentsTitle=document.createElement('h4');commentsTitle.textContent='Kommentare';commentsSection.append(commentsTitle);
  for(const comment of commentResult.data||[]){const item=document.createElement('article');item.className='community-comment';const body=document.createElement('p');body.textContent=comment.body;const date=document.createElement('small');date.textContent=new Date(comment.created_at).toLocaleDateString('de-DE');item.append(body,date);commentsSection.append(item);}
  const commentForm=document.createElement('form');commentForm.className='community-inline-form';const commentInput=document.createElement('textarea');commentInput.name='body';commentInput.maxLength=3000;commentInput.rows=2;commentInput.required=true;commentInput.placeholder='Kommentar schreiben …';const sendComment=document.createElement('button');sendComment.type='submit';sendComment.className='community-secondary';sendComment.textContent='Kommentar senden';commentForm.append(commentInput,sendComment);commentForm.addEventListener('submit',async e=>{e.preventDefault();const result=await c.from('community_trail_comments').insert({trail_id:t.id,user_id:cloudUser.id,body:commentInput.value.trim()});if(result.error){feedback.textContent='Kommentar konnte nicht gespeichert werden: '+result.error.message;return;}detail(t);});commentsSection.append(commentForm);
  const actions=document.createElement('div');actions.className='community-detail-actions';const favorite=document.createElement('button');favorite.type='button';favorite.className='community-secondary';favorite.textContent=favoriteResult.data?'♥ Favorit entfernen':'♡ Als Favorit speichern';favorite.addEventListener('click',async()=>{const result=favoriteResult.data?await c.from('community_trail_favorites').delete().eq('trail_id',t.id).eq('user_id',cloudUser.id):await c.from('community_trail_favorites').insert({trail_id:t.id,user_id:cloudUser.id});if(result.error){feedback.textContent='Favorit konnte nicht geändert werden: '+result.error.message;return;}detail(t);});actions.append(favorite);
  if(active!=='mine'){const report=document.createElement('button');report.type='button';report.className='community-secondary';report.textContent='Trail melden';report.addEventListener('click',async()=>{const reason=prompt('Warum möchtest du diesen Trail melden? (unsafe, spam, copyright, abuse, privacy, other)','unsafe');if(!reason)return;const allowed=['unsafe','spam','copyright','abuse','privacy','other'];if(!allowed.includes(reason)){feedback.textContent='Bitte einen gültigen Meldegrund eingeben: '+allowed.join(', ');return;}const result=await c.from('community_reports').insert({reporter_id:cloudUser.id,target_type:'trail',target_id:t.id,reason_code:reason});feedback.textContent=result.error?'Meldung fehlgeschlagen: '+result.error.message:'Danke. Deine Meldung wurde übermittelt.';});actions.append(report);}
  d.append(reviewSection,commentsSection,actions);
  }
  const detailNav=document.createElement('nav');detailNav.className='community-detail-nav';detailNav.setAttribute('aria-label','Trail-Detailbereiche');
  const navTargets=[{label:'Überblick',target:meta},{label:'Strecke',target:routeBlock,show:!!gpx},{label:'Fotos',target:galleryBlock,show:images.length>0},{label:'Dateien',target:filesBlock,show:files.children.length>0},{label:'Community',target:d.querySelector('.community-feedback-section'),show:!!d.querySelector('.community-feedback-section')}].filter(item=>item.show!==false&&item.target);
  const navButtons=[];
  const activateNav=index=>{navButtons.forEach((button,i)=>{const activeButton=i===index;button.classList.toggle('is-active',activeButton);if(activeButton)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');});};
  navTargets.forEach((item,index)=>{item.target.id='community-detail-section-'+index;const button=document.createElement('button');button.type='button';button.className='community-detail-nav-button'+(index===0?' is-active':'');button.textContent=item.label;button.setAttribute('aria-controls',item.target.id);button.addEventListener('click',()=>{activateNav(index);item.target.scrollIntoView({behavior:'smooth',block:'start'});});navButtons.push(button);detailNav.append(button);});
  if(navTargets.length>1){d.insertBefore(detailNav,routeBlock);if('IntersectionObserver' in window){d._communityNavObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible.length){const index=navTargets.findIndex(item=>item.target===visible[0].target);if(index>=0)activateNav(index);}},{root:null,rootMargin:'-18% 0px -68% 0px',threshold:0});navTargets.forEach(item=>d._communityNavObserver.observe(item.target));}}
  feedback.textContent='Details geladen.';
 }catch(error){feedback.textContent='Trail-Details konnten nicht vollständig geladen werden: '+error.message;feedback.classList.add('is-error');}
}
async function updateVisibility(t){const c=client();if(!c)return;const visibility=t.visibility==='public'?'private':'public',status=visibility==='public'?'published':'draft';try{const {error}=await c.from(TABLE).update({visibility,publication_status:status,published_at:visibility==='public'?new Date().toISOString():null,map_location_enabled:false,start_latitude:null,start_longitude:null}).eq('id',t.id).eq('owner_id',cloudUser.id);if(error)throw error;setStatus('Sichtbarkeit aktualisiert.');await load();$('communityDetail').hidden=true;}catch(e){setStatus('Änderung fehlgeschlagen: '+e.message,true);}}
async function updateMapLocation(t,enabled,gpx,feedback,button){
 const c=client();if(!c)return;
 if(enabled&&(t.visibility!=='public'||t.publication_status!=='published')){feedback.textContent='Bitte veröffentliche den Trail zuerst.';return;}
 button.disabled=true;button.textContent='Aktualisiere Freigabe …';
 try{
  let coordinates={map_location_enabled:false,start_latitude:null,start_longitude:null};
  if(enabled){
   if(!gpx)throw new Error('Für die Kartenfreigabe wird eine GPX-Datei benötigt.');
   const {data:signed,error:signedError}=await c.storage.from(BUCKET).createSignedUrl(gpx.storage_path,120);
   if(signedError)throw signedError;
   const response=await fetch(signed.signedUrl);if(!response.ok)throw new Error('GPX-Datei konnte nicht gelesen werden.');
   const stats=parseGpxText(await response.text());const start=stats.points[0];
   coordinates={map_location_enabled:true,start_latitude:start.lat,start_longitude:start.lon};
  }
  const {error}=await c.from(TABLE).update(coordinates).eq('id',t.id).eq('owner_id',cloudUser.id);
  if(error)throw error;
  setStatus(enabled?'Startpunkt wird auf der öffentlichen Community-Karte angezeigt.':'Startpunkt wurde von der öffentlichen Karte entfernt.');
  await load();$('communityDetail').hidden=true;
 }catch(error){feedback.textContent='Kartenfreigabe konnte nicht geändert werden: '+error.message;feedback.classList.add('is-error');button.disabled=false;button.textContent=t.map_location_enabled?'Startpunkt von öffentlicher Karte entfernen':'Startpunkt auf öffentlicher Karte freigeben';}
}
async function saveTrail(event){
 event.preventDefault();if(busy)return;const c=client();if(!c){setStatus('Bitte zuerst anmelden.',true);return;}const form=event.currentTarget,data=new FormData(form),title=String(data.get('title')||'').trim();if(!title){setStatus('Bitte einen Trail-Namen eingeben.',true);return;}
 const images=Array.from(form.elements.images.files||[]),gpx=form.elements.gpx.files?.[0]||null,files=[...images,...(gpx?[gpx]:[])];if(files.some(f=>f.size>26214400)){setStatus('Eine Datei überschreitet 25 MB.',true);return;}if(gpx&&!/\.gpx$/i.test(gpx.name)){setStatus('Bitte eine Datei mit der Endung .gpx auswählen.',true);return;}
 const visibility=form.elements.visibility.checked?'public':'private',gpxEnabled=form.elements.gpx_download_enabled.checked&&visibility==='public';
 busy=true;const button=$('communitySaveTrail');button.disabled=true;button.textContent='Speichere …';setStatus('Trail wird gespeichert …');
 let trailId=null,uploaded=[];
 try{
  const gpxStats=gpx?parseGpxText(await gpx.text()):null;const mapLocationEnabled=form.elements.map_location_enabled.checked&&visibility==='public'&&(!!gpxStats||!!editingTrail?.map_location_enabled);const row={owner_id:cloudUser.id,title,description:String(data.get('description')||''),region_name:String(data.get('region_name')||'').trim()||null,country_code:String(data.get('country_code')||'').trim().toUpperCase()||null,distance_m:data.get('distance_km')?Number(data.get('distance_km'))*1000:(gpxStats?.distance_m||null),ascent_m:data.get('ascent_m')?Number(data.get('ascent_m')):(gpxStats?.ascent_m??null),descent_m:data.get('descent_m')?Number(data.get('descent_m')):(gpxStats?.descent_m??null),difficulty:String(data.get('difficulty')||'')||null,surface_summary:String(data.get('surface_summary')||'').trim()||null,start_location_label:String(data.get('start_location_label')||'').trim()||null,map_location_enabled:mapLocationEnabled,start_latitude:mapLocationEnabled?(gpxStats?gpxStats.points[0].lat:editingTrail.start_latitude):null,start_longitude:mapLocationEnabled?(gpxStats?gpxStats.points[0].lon:editingTrail.start_longitude):null,visibility,publication_status:visibility==='public'?'published':'draft',gpx_download_enabled:gpxEnabled,published_at:visibility==='public'?new Date().toISOString():null};
  if(editingTrail){trailId=editingTrail.id;const {error}=await c.from(TABLE).update(row).eq('id',trailId).eq('owner_id',cloudUser.id);if(error)throw error;}else{const {data:created,error}=await c.from(TABLE).insert(row).select('id').single();if(error)throw error;trailId=created.id;}
  for(const file of files){const isGpx=file===gpx,kind=isGpx?'gpx':'image',contentType=await communityUploadMime(file,kind);const safe=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90)||'file';const path=cloudUser.id+'/'+trailId+'/'+crypto.randomUUID()+'-'+safe;
   const {error:assetError}=await c.from(ASSETS).insert({trail_id:trailId,owner_id:cloudUser.id,asset_kind:kind,storage_path:path,content_type:contentType,file_size:file.size,download_enabled:isGpx&&gpxEnabled});
   if(assetError)throw assetError;
   const uploadBody=new Blob([file],{type:contentType});const {error:uploadError}=await c.storage.from(BUCKET).upload(path,uploadBody,{contentType,upsert:false});if(uploadError)throw new Error('Upload von '+file.name+' ('+contentType+') fehlgeschlagen: '+uploadError.message);uploaded.push(path);
  }
  if(gpx&&editingTrail){
   const {data:existing,error:queryError}=await c.from(ASSETS).select('id,storage_path').eq('trail_id',trailId).eq('owner_id',cloudUser.id).eq('asset_kind','gpx');
   if(queryError)throw queryError;
   const newPaths=new Set(uploaded),oldAssets=(existing||[]).filter(a=>!newPaths.has(a.storage_path));
   if(oldAssets.length){const {error:storageError}=await c.storage.from(BUCKET).remove(oldAssets.map(a=>a.storage_path));if(storageError)throw new Error('Neue GPX wurde hochgeladen, aber die alte Datei konnte nicht ersetzt werden: '+storageError.message);const {error:deleteError}=await c.from(ASSETS).delete().in('id',oldAssets.map(a=>a.id)).eq('owner_id',cloudUser.id);if(deleteError)throw deleteError;}
  }
  setStatus(editingTrail?'Trail erfolgreich aktualisiert.':visibility==='public'?'Trail veröffentlicht.':'Trail privat gespeichert.');form.reset();closeForm();active='mine';document.querySelector('[data-community-view="mine"]')?.click();await load();
 }catch(error){setStatus('Speichern/Upload fehlgeschlagen: '+error.message,true);if(uploaded.length){try{await c.storage.from(BUCKET).remove(uploaded);}catch(_){}}if(trailId&&!editingTrail){try{await c.from(TABLE).delete().eq('id',trailId).eq('owner_id',cloudUser.id);}catch(_){}}}
 finally{busy=false;button.disabled=false;button.textContent='Trail speichern';}
}
function styles(){if($('northboundCommunityStyles'))return;const style=document.createElement('style');style.id='northboundCommunityStyles';style.textContent=`
#northboundCommunity{color:var(--text,#f4f7fb);padding:8px 0 30px}.community-head,.community-form-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin:8px 0 18px}.community-eyebrow{font-size:10px;font-weight:850;letter-spacing:.14em;color:#7fd8ff}.community-head h2,.community-form h3{margin:5px 0;font-size:clamp(22px,4vw,30px)}.community-head p,.community-form-head p{margin:5px 0;color:#aebdca;font-size:13px}.community-primary,.community-secondary,.community-close{border-radius:10px;padding:10px 14px;min-height:42px;font-weight:750;cursor:pointer}.community-primary{background:#ff6a00;color:#fff;border:1px solid #ff6a00}.community-secondary,.community-close{background:#172638;color:#eaf3fa;border:1px solid #40566b}.community-tabs{display:flex;gap:8px;border-bottom:1px solid #34485a;margin:12px 0;padding-bottom:8px}.community-tabs button{background:transparent;border:1px solid transparent;color:#c8d5e0;border-radius:9px;padding:9px 14px}.community-tabs button[aria-selected=true]{background:#26394c;border-color:#52718a;color:#fff}.community-toolbar{display:flex;gap:12px;align-items:end;margin:14px 0;flex-wrap:wrap}.community-toolbar label,.community-form label{display:flex;flex-direction:column;gap:6px;color:#c8d5e0;font-size:12px;font-weight:700;flex:1;min-width:150px}.community-search{flex:2!important}.community-toolbar input,.community-toolbar select,.community-form input:not([type=checkbox]),.community-form select,.community-form textarea{width:100%;min-height:42px;border:1px solid #40566b;border-radius:9px;background:#101c2a;color:#f5f8fb;padding:10px;font:inherit}.community-form textarea{resize:vertical}.community-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,175px),1fr));align-items:end}.community-toolbar label{min-width:0}.community-toolbar button{min-height:42px}@media(min-width:900px){.community-toolbar .community-search{grid-column:span 2}}
.community-discovery-map{margin:16px 0 18px;padding:12px;border:1px solid #40566b;border-radius:14px;background:#111e2c}.community-map-heading{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.community-map-heading strong{font-size:15px}.community-map-heading span{font-size:11px;color:#aebdca}.community-discovery-map-canvas{height:320px;border-radius:10px;overflow:hidden;background:#172638}.community-discovery-map .community-hint{margin-top:8px}.community-map-open{margin-top:6px;padding:6px 9px;border:0;border-radius:7px;background:#ff6a00;color:#fff;font-weight:700}@media(max-width:620px){.community-discovery-map-canvas{height:260px}.community-map-heading{align-items:flex-start;flex-direction:column}}
.community-status{padding:11px 13px;border:1px solid #34485a;border-radius:10px;background:#142333;color:#c9d7e2;font-size:13px;margin:14px 0}.community-status.is-error{border-color:#a64b43;color:#ffc1b8}.community-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:12px}.community-card{border:1px solid #34485a;border-radius:14px;background:#121f2e;padding:15px;min-width:0;transition:border-color .18s ease,box-shadow .18s ease}.community-card.is-map-selected{border-color:#ff8a36;box-shadow:0 0 0 2px #ff8a3655,0 8px 24px #0005}.community-show-on-map{margin-left:7px}.community-card h3{margin:0 0 5px;font-size:17px}.community-region,.community-description{color:#aebdca;font-size:12px;line-height:1.5}.community-metrics{font-weight:800;color:#7fd8ff;margin:10px 0}.community-difficulty,.community-state{display:inline-block;border:1px solid #40566b;border-radius:99px;padding:4px 8px;color:#dce8f0;font-size:11px;margin:0 5px 8px 0}.community-empty{grid-column:1/-1;border:1px dashed #40566b;border-radius:12px;padding:24px;text-align:center;color:#b8c7d4}.community-form,.community-detail{margin-top:16px;padding:18px;border:1px solid #40566b;border-radius:14px;background:#111e2c}.community-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.community-form .wide{grid-column:1/-1}.community-check{flex-direction:row!important;align-items:center;gap:9px!important}.community-check input{width:18px;height:18px;accent-color:#ff6a00}.community-hint{margin:0;color:#aebdca;font-size:12px;line-height:1.5}.community-form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.community-detail h3{font-size:23px}.community-detail p{color:#c6d3df;line-height:1.6}.community-gpx-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin:12px 0}.community-gpx-metric{display:flex;flex-direction:column;gap:4px;padding:11px;border:1px solid #34485a;border-radius:10px;background:#142333;min-width:0}.community-gpx-metric strong{font-size:16px;color:#7fd8ff;font-variant-numeric:tabular-nums}.community-gpx-metric span{font-size:10px;color:#b9c9d6}.community-map-controls{display:flex;justify-content:flex-end;margin-bottom:8px}.community-gpx-map-figure.is-expanded .community-gpx-map{height:65vh;min-height:380px}.community-gpx-figure svg{min-height:130px}
.community-gpx-map-figure{margin:0;border:1px solid #40566b;border-radius:12px;padding:10px;background:#0d1824;min-width:0}.community-gpx-map{width:100%;height:300px;border-radius:9px;overflow:hidden;background:#172638}.community-gpx-map-figure figcaption{font-size:11px;color:#b9c9d6;margin-top:7px}.community-gpx-map .leaflet-control-attribution{font-size:9px}.community-gpx-map .leaflet-container{font:inherit}
.community-gpx-figure{margin:0;border:1px solid #40566b;border-radius:12px;padding:10px;background:#0d1824;min-width:0}.community-gpx-figure svg{display:block;width:100%;height:auto;max-height:150px}.community-gpx-figure figcaption{font-size:11px;color:#b9c9d6;margin-top:6px}.community-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px;margin:14px 0}.community-gallery figure{margin:0;border:1px solid #40566b;border-radius:12px;overflow:hidden;background:#0d1824}.community-gallery img{display:block;width:100%;max-height:280px;object-fit:cover}.community-gallery figcaption{padding:8px;color:#b9c9d6;font-size:11px}.community-files,.community-detail-actions{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}.community-download{display:inline-flex;align-items:center;text-decoration:none}.community-feedback-section{margin-top:20px;padding-top:12px;border-top:1px solid #34485a}.community-feedback-section h4{margin:0 0 8px;font-size:16px}.community-inline-form{display:grid;grid-template-columns:minmax(100px,160px) 1fr auto;gap:8px;margin-top:10px}.community-inline-form textarea,.community-inline-form select{min-width:0;background:#101c2a;color:#f5f8fb;border:1px solid #40566b;border-radius:9px;padding:10px}.community-comment{padding:8px 10px;border:1px solid #34485a;border-radius:9px;margin:7px 0}.community-comment p{margin:0 0 5px}.community-comment small{color:#94a8b9}@media(max-width:620px){.community-inline-form{grid-template-columns:1fr}.community-inline-form button{width:100%}}@media(max-width:620px){.community-head,.community-form-head{flex-direction:column}.community-primary{width:100%}.community-form-grid{grid-template-columns:1fr}.community-form .wide{grid-column:auto}.community-toolbar{display:grid;grid-template-columns:1fr}.community-form-actions{flex-direction:column-reverse}.community-form-actions button{width:100%}}
`;document.head.append(style);}
function init(){shell();styles();if(typeof switchTab==='function'&&!window.__northboundCommunityWrapped){const original=switchTab;window.switchTab=function(name){if(name==='community'){show();return;}const panel=root();if(panel)panel.hidden=true;return original(name);};window.__northboundCommunityWrapped=true;} }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
