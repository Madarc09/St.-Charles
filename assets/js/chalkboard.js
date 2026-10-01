/* v270: live writing on the original basement chalkboard. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory(require('./pool-core'));
  else {
    const view=factory(root.PoolCore);let signature='',latest=null;
    const enlarged=()=>document.getElementById('enlargedChalkboardContent');
    root.renderSeasonBoard=function(rows,draft){
      latest={rows,draft};const host=document.getElementById('seasonBoard');if(!host)return;
      const next=JSON.stringify([rows,draft.seasonId,!!draft.locked]);if(next===signature)return;signature=next;
      host.innerHTML=view.render(rows,draft);
      if(document.getElementById('enlargedChalkboard')?.open)enlarged().innerHTML=view.render(rows,draft,{expanded:true});
    };
    function open(){
      const dialog=document.getElementById('enlargedChalkboard');if(!dialog)return;
      if(latest)enlarged().innerHTML=view.render(latest.rows,latest.draft,{expanded:true});
      else enlarged().innerHTML='<p>Loading your saved pool…</p>';
      if(!dialog.open)dialog.showModal();
    }
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-enlarge-chalkboard]')){e.preventDefault();open();}
      if(e.target.closest('[data-close-chalkboard]'))document.getElementById('enlargedChalkboard')?.close();
      // A roster room opened from the enlarged board must be visible immediately.
      if(e.target.closest('[data-roster-owner]') && document.getElementById('enlargedChalkboard')?.open)document.getElementById('enlargedChalkboard').close();
    },true);
  }
})(typeof window!=='undefined'?window:this,function(C){
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const groups=[['F','Forwards'],['D','Defence'],['G','Goalies']];
  const ownerOrder=['andrew','chris','scott','nick','tyler'];
  function rosterGroup(players,bucket,label){
    const roster=C.sortRoster(players).filter(p=>C.bucket(p)===bucket);
    return `<section class="chalk-position" data-position="${bucket}"><h4>${label}</h4>${roster.map(p=>{
      // Keep the team identity: never reduce New York Islanders to "New Goalies".
      const display=bucket==='G'?String(p.name).replace(/\s+Goalies$/i,''):p.name;
      return `<div class="chalk-player" title="${esc(p.name)} · ${C.num(p.fpts)} FPTS"><span>${esc(display)}</span><span class="chalk-points">${C.num(p.fpts)}</span></div>`;
    }).join('')||'<div class="chalk-empty">TBA</div>'}</section>`;
  }
  function rosterCard(row){
    return `<article class="chalk-roster" aria-label="${esc(row.ownerName)}’s roster"><header><h3><button type="button" data-roster-owner="${esc(row.ownerId)}">${esc(row.ownerName)}</button></h3><span>FPTS</span></header>${groups.map(([b,l])=>rosterGroup(row.players,b,l)).join('')}</article>`;
  }
  function render(rows,draft,{expanded=false}={}){
    const ordered=ownerOrder.map(id=>rows.find(r=>r.ownerId===id)).filter(Boolean);
    const totals=(r,k)=>r.players.reduce((sum,p)=>sum+C.num(p[k]),0);
    return `<div class="chalk-layout"><section class="chalk-standings" aria-label="Pool standings">${expanded?'<h2>Standings</h2>':''}<table><thead><tr><th scope="col">Manager</th><th scope="col">FPTS</th><th scope="col">G</th><th scope="col">A</th><th scope="col">SHG</th><th scope="col">GWG</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row"><button type="button" data-roster-owner="${esc(r.ownerId)}">${esc(r.ownerName)}</button></th><td class="chalk-points">${C.num(r.total)}</td>${['goals','assists','shortHandedGoals','gameWinningGoals'].map(k=>`<td>${totals(r,k)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="chalk-saved">${draft.locked?'<button type="button" data-view-final-draft>Final draft locked · 60/60 saved ↗</button>':`${draft.picks?.length||0}/60 picks saved`}</p></section><section class="chalk-rosters" aria-label="All five rosters">${expanded?'<h2>Rosters</h2>':''}<div class="chalk-roster-grid">${ordered.map(rosterCard).join('')}</div></section></div>`;
  }
  return {render,rosterCard,rosterGroup};
});
