/* NORTHBOUND – private booking documents per accommodation stay */
(function(){
  'use strict';
  const BUCKET='trail-private-documents';
  const KEY='trailPrivateBookingDocuments';
  const MAX_BYTES=20*1024*1024;
  const $=s=>document.querySelector(s);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safePart=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);
  function ready(){return !!(window.cloudUser&&window.cloudReady&&window.cloudClient);}
  function read(){try{return window.readPrivatePlannerObject(KEY)||{};}catch(e){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}}}
  function write(data){localStorage.setItem(KEY,JSON.stringify(data));if(typeof window.queuePlannerCloudSave==='function')window.queuePlannerCloudSave();}
  function getDocs(eventId,stayId){const all=read(),byEvent=all[eventId]||{};return Array.isArray(byEvent[stayId])?byEvent[stayId]:[];}
  function panel(eventId,stayId){
    const docs=getDocs(eventId,stayId);
    const rows=docs.map((doc,index)=>'<div class="stay-document-row"><span class="stay-document-type">'+(doc.documentType==='invoice'?'Rechnung':doc.documentType==='payment_receipt'?'Zahlungsbeleg':doc.documentType==='cancellation'?'Stornierung':doc.documentType==='correspondence'?'Korrespondenz':doc.documentType==='booking_confirmation'?'Buchungsbestätigung':'Dokument')+'</span><span class="stay-document-name">'+esc(doc.originalName||'Unterlage')+'</span><span class="stay-document-actions"><button type="button" data-stay-doc-open="'+index+'" data-event-id="'+esc(eventId)+'" data-stay-id="'+esc(stayId)+'">Öffnen</button><button type="button" data-stay-doc-delete="'+index+'" data-event-id="'+esc(eventId)+'" data-stay-id="'+esc(stayId)+'" class="stay-document-delete">Löschen</button></span></div>').join('');
    return '<section class="stay-documents" data-stay-documents="'+esc(eventId)+'" data-stay-id="'+esc(stayId)+'"><h4>📎 Buchungsunterlagen</h4>'+(rows||'<p class="plan-meta">Noch keine Unterlagen für diesen Aufenthalt hinterlegt.</p>')+'<div class="stay-document-upload"><label>Unterlage hinzufügen<input type="file" accept=".pdf,.eml,application/pdf,message/rfc822" data-stay-doc-upload data-event-id="'+esc(eventId)+'" data-stay-id="'+esc(stayId)+'"></label><select data-stay-doc-type aria-label="Dokumentart"><option value="booking_confirmation">Buchungsbestätigung</option><option value="invoice">Rechnung</option><option value="payment_receipt">Zahlungsbeleg</option><option value="cancellation">Stornierung</option><option value="correspondence">Korrespondenz</option><option value="other">Sonstiges</option></select></div><p class="stay-document-status" aria-live="polite">PDF und EML · privat gespeichert · max. 20 MB</p></section>';
  }
  function enhance(html,e){
    if(!ready()||!e||!e.id||typeof window.getAccommodationStays!=='function')return html;
    const booking=(window.readPrivatePlannerObject('trailPrivateBookings')||{})[e.id]||{};
    const stays=window.getAccommodationStays(booking);
    let index=0;
    return html.replace(/<\/article>/g,function(close){
      const stay=stays[index++];
      if(!stay)return close;
      const stayId=safePart(stay.id||'legacy');
      return panel(String(e.id),stayId)+close;
    });
  }
  function refreshPanel(eventId,stayId){
    const node=document.querySelector('[data-stay-documents="'+CSS.escape(eventId)+'"][data-stay-id="'+CSS.escape(stayId)+'"]');
    if(!node)return;
    const wrap=document.createElement('div');wrap.innerHTML=panel(eventId,stayId);
    node.replaceWith(wrap.firstElementChild);
  }
  async function upload(input){
    const file=input.files&&input.files[0],eventId=input.dataset.eventId,stayId=input.dataset.stayId;
    if(!file||!eventId||!stayId)return;
    const node=input.closest('.stay-documents'),status=node&&node.querySelector('.stay-document-status');
    const say=t=>{if(status)status.textContent=t;};
    if(typeof window.requirePlannerLogin==='function'&&!window.requirePlannerLogin('private Buchungsunterlagen')){input.value='';return;}
    if(!ready()){say('Bitte zuerst beim persönlichen Cloud-Konto anmelden.');input.value='';return;}
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['pdf','eml'].includes(ext)){say('Bitte ausschließlich PDF- oder EML-Dateien auswählen.');input.value='';return;}
    if(file.size>MAX_BYTES){say('Die Datei ist größer als 20 MB.');input.value='';return;}
    const typeSelect=node.querySelector('[data-stay-doc-type]');
    const documentType=typeSelect?typeSelect.value:'other';
    say('Unterlage wird privat hochgeladen …');
    const userId=window.cloudUser.id;
    const path=userId+'/bookings/'+safePart(eventId)+'/'+safePart(stayId)+'/'+Date.now()+'-'+safePart(file.name);
    try{
      const result=await window.cloudClient.storage.from(BUCKET).upload(path,file,{contentType:ext==='pdf'?'application/pdf':'message/rfc822',upsert:false});
      if(result.error)throw result.error;
      const all=read();all[eventId]=all[eventId]||{};all[eventId][stayId]=Array.isArray(all[eventId][stayId])?all[eventId][stayId]:[];
      all[eventId][stayId].push({id:'doc-'+Date.now().toString(36),eventId,stayId,storagePath:path,originalName:file.name,mimeType:ext==='pdf'?'application/pdf':'message/rfc822',size:file.size,documentType,uploadedAt:new Date().toISOString()});
      try{write(all);}catch(saveError){await window.cloudClient.storage.from(BUCKET).remove([path]);throw saveError;}
      refreshPanel(eventId,stayId);
    }catch(error){say('Upload fehlgeschlagen: '+(error&&error.message||'Unbekannter Fehler'));}
    finally{input.value='';}
  }
  async function openDoc(eventId,stayId,index){
    if(!ready())return;
    const doc=getDocs(eventId,stayId)[index];if(!doc||!doc.storagePath)return;
    if(!String(doc.storagePath).startsWith(window.cloudUser.id+'/')||String(doc.storagePath).split('/').includes('..'))return;
    const popup=window.open('about:blank','_blank');
    try{
      const result=await window.cloudClient.storage.from(BUCKET).createSignedUrl(doc.storagePath,600,{download:false});
      if(result.error)throw result.error;
      if(!result.data||!result.data.signedUrl)throw new Error('Kein sicherer Dokumentlink verfügbar.');
      if(popup)popup.location.href=result.data.signedUrl;else window.location.href=result.data.signedUrl;
    }catch(error){if(popup)popup.close();if(typeof window.cloudMessage==='function')window.cloudMessage('Unterlage konnte nicht geöffnet werden: '+(error&&error.message||'Unbekannter Fehler'));}
  }
  async function deleteDoc(eventId,stayId,index,button){
    if(!ready())return;
    if(!window.confirm('Diese Unterlage wirklich dauerhaft löschen?'))return;
    const docs=getDocs(eventId,stayId),doc=docs[index];if(!doc)return;
    const node=button.closest('.stay-documents'),status=node&&node.querySelector('.stay-document-status');
    if(status)status.textContent='Unterlage wird gelöscht …';
    try{
      if(!String(doc.storagePath||'').startsWith(window.cloudUser.id+'/'))throw new Error('Ungültiger privater Dateipfad.');
      const removed=await window.cloudClient.storage.from(BUCKET).remove([doc.storagePath]);
      if(removed.error)throw removed.error;
      const all=read();all[eventId][stayId]=docs.filter((_,i)=>i!==index);write(all);refreshPanel(eventId,stayId);
    }catch(error){if(status)status.textContent='Löschen fehlgeschlagen: '+(error&&error.message||'Unbekannter Fehler');}
  }
  if(typeof window.renderYearAccommodationForm==='function'){
    const original=window.renderYearAccommodationForm;
    window.renderYearAccommodationForm=function(e,r,id,ri,uid){return enhance(original.apply(this,arguments),e);};
  }
  document.addEventListener('change',function(event){if(event.target.matches('[data-stay-doc-upload]'))upload(event.target);});
  document.addEventListener('click',function(event){
    const open=event.target.closest('[data-stay-doc-open]');
    if(open){openDoc(open.dataset.eventId,open.dataset.stayId,Number(open.dataset.stayDocOpen));return;}
    const del=event.target.closest('[data-stay-doc-delete]');
    if(del)deleteDoc(del.dataset.eventId,del.dataset.stayId,Number(del.dataset.stayDocDelete),del);
  });
  const style=document.createElement('style');
  style.textContent='.stay-documents{margin:12px 0 4px;padding:11px;border:1px solid #344b5d;border-radius:10px;background:#101a23}.stay-documents h4{margin:0 0 8px;color:#9cddf7;font-size:13px}.stay-document-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 0;border-top:1px solid #2b3946;font-size:11px}.stay-document-type{color:#9cddf7;font-weight:700}.stay-document-name{overflow-wrap:anywhere}.stay-document-actions{display:flex;gap:5px}.stay-document-actions button{border:1px solid #40586a;border-radius:7px;background:#172632;color:#c9efff;padding:5px 7px;font:inherit}.stay-document-actions .stay-document-delete{color:#ffb4a8}.stay-document-upload{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:9px}.stay-document-upload label{display:grid;gap:5px;font-size:11px;font-weight:700}.stay-document-upload input{max-width:100%;font-size:11px}.stay-document-upload select{max-width:100%;padding:7px;border-radius:7px}.stay-document-status{margin:7px 0 0;font-size:11px;color:#aab7c2}';
  document.head.appendChild(style);
})();