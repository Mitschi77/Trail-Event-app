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
  function bookingRecordPanel(eventId,stay){
    const stayId=safePart(stay.id||'stay-0');
    const fields=[
      ['provider','Anbieter','text'],
      ['bookingReference','Buchungsnummer','text'],
      ['cancellationUntil','Kostenlose Stornierung bis','date'],
      ['contactName','Ansprechpartner','text'],
      ['contactEmail','Kontakt-E-Mail','email'],
      ['contactPhone','Telefon','tel']
    ];
    return '<details class="stay-booking-record"><summary>📋 Buchungsakte</summary><div class="stay-booking-record-grid">'+fields.map(([key,label,type])=>'<label>'+label+'<input type="'+type+'" data-booking-record-field="'+key+'" value="'+esc(stay[key]||'')+'"></label>').join('')+'<label class="stay-booking-record-wide">Stornierungsbedingungen<textarea data-booking-record-field="cancellationPolicy" rows="2">'+esc(stay.cancellationPolicy||'')+'</textarea></label></div><button type="button" data-booking-record-save data-event-id="'+esc(eventId)+'" data-stay-id="'+esc(stayId)+'">Buchungsdaten speichern</button><span class="stay-booking-record-status" aria-live="polite"></span></details>';
  }
  function saveBookingRecord(button){
    const eventId=button.dataset.eventId,stayId=button.dataset.stayId;
    if(!ready()||!eventId||!stayId)return;
    if(typeof window.requirePlannerLogin==='function'&&!window.requirePlannerLogin('deine persönliche Buchungsakte'))return;
    const bookings=window.readPrivatePlannerObject('trailPrivateBookings')||{};
    const booking=bookings[eventId]||{};
    const stays=typeof window.getAccommodationStays==='function'?window.getAccommodationStays(booking):[];
    const stay=stays.find((item,index)=>safePart(item.id||('stay-'+index))===stayId);
    if(!stay){window.cloudMessage&&window.cloudMessage('Aufenthalt nicht gefunden. Bitte Ansicht aktualisieren.');return;}
    const panel=button.closest('.stay-booking-record');
    panel.querySelectorAll('[data-booking-record-field]').forEach(input=>{stay[input.dataset.bookingRecordField]=input.value.trim();});
    bookings[eventId]={...booking,stays,updatedAt:new Date().toISOString()};
    try{
      localStorage.setItem('trailPrivateBookings',JSON.stringify(bookings));
      if(typeof window.queuePlannerCloudSave==='function')window.queuePlannerCloudSave();
      const status=panel.querySelector('.stay-booking-record-status');
      if(status)status.textContent='Gespeichert · Synchronisierung vorgemerkt';
    }catch(error){window.cloudMessage&&window.cloudMessage('Buchungsdaten konnten nicht gespeichert werden: '+(error.message||'Unbekannter Fehler'));}
  }
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
      const stay=stays[index];
      if(!stay)return close;
      const stayId=safePart(stay.id||('stay-'+index));
      index++;
      return bookingRecordPanel(String(e.id),stay)+panel(String(e.id),stayId)+close;
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
  async function cleanupRemovedStay(eventId,stayId){
    const all=read(),docs=all[eventId]&&all[eventId][stayId];
    if(!Array.isArray(docs)||!docs.length)return;
    const paths=docs.map(doc=>doc.storagePath).filter(path=>typeof path==='string'&&path.startsWith(window.cloudUser.id+'/'));
    try{
      if(paths.length){const result=await window.cloudClient.storage.from(BUCKET).remove(paths);if(result.error)throw result.error;}
      delete all[eventId][stayId];if(!Object.keys(all[eventId]).length)delete all[eventId];write(all);
    }catch(error){if(typeof window.cloudMessage==='function')window.cloudMessage('Aufenthalt entfernt; zugehörige Dokumente konnten nicht automatisch bereinigt werden: '+(error&&error.message||'Unbekannter Fehler'));}
  }
  if(typeof window.removeAccommodationStay==='function'){
    const originalRemove=window.removeAccommodationStay;
    window.removeAccommodationStay=function(id,stayId,uid){
      const event=typeof EVENTS!=='undefined'?EVENTS[id]:null,eventId=event&&String(event.id);
      const before=eventId&&window.getAccommodationStays?window.getAccommodationStays((window.readPrivatePlannerObject('trailPrivateBookings')||{})[eventId]||{}):[];
      const index=before.findIndex((stay,i)=>String(stay.id||('stay-'+i))===String(stayId));
      const removed= index>=0 ? before[index] : null;
      const result=originalRemove.apply(this,arguments);
      if(removed&&eventId){
        const after=window.getAccommodationStays((window.readPrivatePlannerObject('trailPrivateBookings')||{})[eventId]||{});
        if(!after.some((stay,i)=>String(stay.id||('stay-'+i))===String(stayId)))cleanupRemovedStay(eventId,safePart(removed.id||('stay-'+index)));
      }
      return result;
    };
  }
  if(typeof window.renderYearAccommodationForm==='function'){
    const original=window.renderYearAccommodationForm;
    window.renderYearAccommodationForm=function(e,r,id,ri,uid){return enhance(original.apply(this,arguments),e);};
  }
  document.addEventListener('change',function(event){if(event.target.matches('[data-stay-doc-upload]'))return upload(event.target);});
  document.addEventListener('click',function(event){
    const recordSave=event.target.closest('[data-booking-record-save]');
    if(recordSave)return saveBookingRecord(recordSave);
    const open=event.target.closest('[data-stay-doc-open]');
    if(open)return openDoc(open.dataset.eventId,open.dataset.stayId,Number(open.dataset.stayDocOpen));
    const del=event.target.closest('[data-stay-doc-delete]');
    if(del)return deleteDoc(del.dataset.eventId,del.dataset.stayId,Number(del.dataset.stayDocDelete),del);
  });
  const style=document.createElement('style');
  style.textContent='.stay-booking-record{margin:10px 0;padding:10px;border:1px solid #344b5d;border-radius:9px;background:#131f29}.stay-booking-record summary{color:#9cddf7;font-size:12px;font-weight:700;cursor:pointer}.stay-booking-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.stay-booking-record-grid label{display:grid;gap:4px;font-size:11px;color:#c7d4df}.stay-booking-record-grid input,.stay-booking-record-grid textarea{width:100%;min-width:0;box-sizing:border-box;padding:7px;border:1px solid #40586a;border-radius:6px;background:#0e1720;color:#e8f4fb}.stay-booking-record-wide{grid-column:1/-1}.stay-booking-record button{border:1px solid #40586a;border-radius:7px;background:#172632;color:#c9efff;padding:7px 10px}.stay-booking-record-status{margin-left:8px;font-size:11px;color:#9cddf7}@media(max-width:520px){.stay-booking-record-grid{grid-template-columns:1fr}}.stay-documents{margin:12px 0 4px;padding:11px;border:1px solid #344b5d;border-radius:10px;background:#101a23}.stay-documents h4{margin:0 0 8px;color:#9cddf7;font-size:13px}.stay-document-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 0;border-top:1px solid #2b3946;font-size:11px}.stay-document-type{color:#9cddf7;font-weight:700}.stay-document-name{overflow-wrap:anywhere}.stay-document-actions{display:flex;gap:5px}.stay-document-actions button{border:1px solid #40586a;border-radius:7px;background:#172632;color:#c9efff;padding:5px 7px;font:inherit}.stay-document-actions .stay-document-delete{color:#ffb4a8}.stay-document-upload{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:9px}.stay-document-upload label{display:grid;gap:5px;font-size:11px;font-weight:700}.stay-document-upload input{max-width:100%;font-size:11px}.stay-document-upload select{max-width:100%;padding:7px;border-radius:7px}.stay-document-status{margin:7px 0 0;font-size:11px;color:#aab7c2}';
  document.head.appendChild(style);
})();