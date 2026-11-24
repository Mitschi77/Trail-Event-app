(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof customElements === 'undefined' || customElements.get('sport-year-entry')) return;
  const options = [['running','Laufen'],['trail_running','Trailrunning'],['cycling','Radfahren'],['swimming','Schwimmen'],['triathlon','Triathlon'],['hiking','Wandern'],['football','Fußball'],['handball','Handball'],['basketball','Basketball'],['volleyball','Volleyball'],['tennis','Tennis'],['padel','Padel'],['badminton','Badminton'],['strength_training','Krafttraining'],['fitness','Fitness'],['backyard','Backyard'],['other','Andere Sportart']];
  class SportYearEntry extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      this.innerHTML = '<section class="sy-entry"><header><p class="eyebrow">SPORTJAHR</p><h2>Aktivität erfassen</h2><p>Sportart wählen – passende Ergebnisfelder erscheinen automatisch.</p></header><form><div class="grid"><label>Titel<input name="title" placeholder="z. B. Abendtraining"></label><label>Sportart<select name="sportCode">' + options.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select></label><label>Beginn<input name="startsAt" type="datetime-local"></label><label>Status<select name="status"><option value="planned">Geplant</option><option value="completed">Absolviert</option><option value="cancelled">Abgesagt</option></select></label><label>Ort<input name="location"></label><label>Dauer (Minuten)<input name="durationMinutes" type="number" min="0"></label><label>Distanz (km)<input name="distanceKm" type="number" min="0" step=".001"></label><label>Höhenmeter<input name="elevationGainM" type="number" min="0"></label></div><fieldset><legend>Ergebnisdaten</legend><div class="results"></div></fieldset><p class="message" role="status" aria-live="polite"></p><button type="submit">Aktivität übernehmen</button></form></section>';
      this.addEventListener('change', e => { if (e.target.name === 'sportCode') this.updateFields(); });
      this.addEventListener('submit', e => this.submitActivity(e));
      this.updateFields();
      if (!document.getElementById('sy-entry-css')) {
        const s = document.createElement('style'); s.id = 'sy-entry-css';
        s.textContent = 'sport-year-entry{display:block;color:#f5f7fa}.sy-entry{background:#0b1117;border:1px solid #273541;border-radius:16px;padding:20px;max-width:900px}.sy-entry .eyebrow{color:#ff6a00;font-size:11px;letter-spacing:.16em;font-weight:800}.sy-entry h2{font-size:26px;margin:6px 0}.sy-entry header p:last-child{color:#aebbc6}.sy-entry .grid,.sy-entry .results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sy-entry label{display:flex;flex-direction:column;gap:6px;color:#dce5eb;font-size:13px}.sy-entry input,.sy-entry select{box-sizing:border-box;width:100%;min-height:42px;padding:10px;background:#111c25;color:#f5f7fa;border:1px solid #40515e;border-radius:9px}.sy-entry fieldset{border:1px solid #34434f;border-radius:12px;margin:18px 0;padding:14px}.sy-entry legend{color:#7fd8ff;font-weight:700}.sy-entry .message{min-height:20px;color:#7fd8ff}.sy-entry button{background:#ff6a00;color:#111;border:0;border-radius:9px;padding:12px 18px;font-weight:800}@media(max-width:560px){.sy-entry{padding:14px}.sy-entry .grid,.sy-entry .results{grid-template-columns:1fr}}';
        document.head.appendChild(s);
      }
    }
    field(label,name,type='text',attrs='') { return '<label>' + label + '<input name="' + name + '" type="' + type + '" ' + attrs + '></label>'; }
    updateFields() {
      const f=this.querySelector('form'), sport=f.elements.sportCode.value, box=this.querySelector('.results'); let html='';
      if(sport==='backyard') html=this.field('Runden','rounds','number','min="0" required')+this.field('Rundenlänge (km)','lapLengthKm','number','min=".001" step=".001" value="6.7"')+this.field('Ausscheiden nach Runde','eliminatedAfterRound','number','min="0"');
      else if(['tennis','padel','badminton'].includes(sport)) html=this.field('Gegner','opponent')+this.field('Partner / Doppel','partner')+this.field('Sätze (z. B. 6:4, 7:6)','setsText','text','placeholder="6:4, 7:6"');
      else if(['football','handball','basketball','volleyball'].includes(sport)) html=this.field('Team','team')+this.field('Gegner','opponent')+this.field('Eigener Spielstand','scoreFor','number','min="0"')+this.field('Gegnerischer Spielstand','scoreAgainst','number','min="0"')+this.field('Einsatzminuten','minutesPlayed','number','min="0"');
      else if(['strength_training','fitness'].includes(sport)) html=this.field('Übung','exerciseName')+this.field('Sätze','setCount','number','min="0"')+this.field('Wiederholungen','reps','number','min="0"')+this.field('Gewicht (kg)','weightKg','number','min="0" step=".5"')+this.field('Dauer (Sekunden)','setDurationSeconds','number','min="0"');
      else if(sport==='triathlon') html=this.field('Schwimmen (km)','swimKm','number','min="0" step=".001"')+this.field('Radfahren (km)','bikeKm','number','min="0" step=".001"')+this.field('Laufen (km)','runKm','number','min="0" step=".001"');
      else html='<p>Allgemeine Aktivitätsdaten. Weitere Sportarten bleiben über das offene Datenmodell erweiterbar.</p>';
      box.innerHTML=html;
    }
    submitActivity(event) {
      event.preventDefault(); const f=event.currentTarget, d=new FormData(f), n=k=>d.get(k)===''||d.get(k)==null?null:Number(d.get(k)), sport=d.get('sportCode');
      const a={title:d.get('title')||'Aktivität',sportCode:sport,startsAt:d.get('startsAt')||null,status:d.get('status'),location:d.get('location')||null,durationSeconds:n('durationMinutes')==null?null:n('durationMinutes')*60,distanceKm:n('distanceKm'),elevationGainM:n('elevationGainM'),result:{}};
      try {
        if(sport==='backyard') a.result=window.SportYear.normalizeBackyardResult({rounds:n('rounds'),lapLengthKm:n('lapLengthKm')||6.7,eliminatedAfterRound:n('eliminatedAfterRound')});
        else if(['football','handball','basketball','volleyball'].includes(sport)) a.result=window.SportYear.normalizeTeamResult({team:d.get('team'),opponent:d.get('opponent'),scoreFor:n('scoreFor'),scoreAgainst:n('scoreAgainst'),minutesPlayed:n('minutesPlayed')});
        else if(['tennis','padel','badminton'].includes(sport)) { const sets=String(d.get('setsText')||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/^(\d+)\s*:\s*(\d+)$/);if(!m)throw Error('Sätze bitte als 6:4, 7:6 eingeben.');return {home:+m[1],away:+m[2]};}); a.result=window.SportYear.normalizeRacketResult({opponent:d.get('opponent'),partner:d.get('partner'),sets}); }
        else if(['strength_training','fitness'].includes(sport)) { const name=String(d.get('exerciseName')||'').trim(), count=n('setCount')||0; a.result=window.SportYear.normalizeStrengthResult({exercises:name?[{name,sets:Array.from({length:Math.min(count,100)},()=>({reps:n('reps'),durationSeconds:n('setDurationSeconds'),weightKg:n('weightKg')}))}]:[]}); }
        else if(sport==='triathlon') a.segments=[['swim','swimming','swimKm'],['bike','cycling','bikeKm'],['run','running','runKm']].map((x,i)=>({sequence:i+1,segmentType:x[0],sportCode:x[1],distance:n(x[2]),distanceUnit:'km'})).filter(x=>x.distance!==null);
        const normalized=window.SportYear.normalizeActivity(a);
        this.querySelector('.message').textContent='Eingaben geprüft. Noch nicht gespeichert – Datenbankanbindung folgt.';
        this.dispatchEvent(new CustomEvent('sport-year-activity',{bubbles:true,composed:true,detail:normalized}));
      } catch(err) { this.querySelector('.message').textContent=err.message||'Eingabe konnte nicht geprüft werden.'; }
    }
  }
  customElements.define('sport-year-entry',SportYearEntry);
})();