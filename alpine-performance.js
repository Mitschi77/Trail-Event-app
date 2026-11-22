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
