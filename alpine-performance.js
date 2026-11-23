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
