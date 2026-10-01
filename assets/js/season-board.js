/* A readable home board. The saved draft remains the source of every roster. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory(require('./pool-core'));
  else {
    const view=factory(root.PoolCore);let signature='';
    root.renderSeasonBoard=function(rows,draft){
      const host=document.getElementById('seasonBoard');if(!host)return;
      const next=JSON.stringify([rows,draft.seasonId,!!draft.locked]);if(next===signature)return;signature=next;
      const focus=document.activeElement?.id;
      host.innerHTML=view.render(rows,draft);
      if(focus && document.getElementById(focus))document.getElementById(focus).focus({preventScroll:true});
    };
    document.addEventListener('click',e=>{
      const link=e.target.closest('[data-home-roster]');if(!link)return;
      const card=document.getElementById('season-roster-'+link.dataset.homeRoster);
      if(card){e.preventDefault();card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});card.focus({preventScroll:true});}
    });
  }
})(typeof window!=='undefined'?window:this,function(C){
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const groups=[['F','Forwards',6],['D','Defence',4],['G','Team goalies',2]];
  function rosterGroup(players,bucket,label,slots){
    const rows=C.sortRoster(players).filter(p=>C.bucket(p)===bucket),goalie=bucket==='G';
    const headings=goalie?['GP','W','A','G','SO','FPTS']:['GP','G','A','SHG','GWG','FPTS'];
    const playerRows=rows.map(p=>{
      const stats=goalie?[p.gamesPlayed,p.goalieWins,p.goalieAssists??p.assists,p.goalieGoals??p.goals,p.goalieShutouts,p.fpts]:[p.gamesPlayed,p.goals,p.assists,p.shortHandedGoals??p.shGoals,p.gameWinningGoals,p.fpts];
      return `<tr><th scope="row"><span>${esc(p.name)}</span><small>${esc(p.nhlTeam||'—')}${goalie?' · Team unit':' · '+esc(p.position||bucket)}</small></th>${stats.map((n,i)=>`<td${i===5?' class="sb-points"':''}>${C.num(n)}</td>`).join('')}</tr>`;
    }).join('');
    return `<section class="sb-position"><h4>${label}<span>${rows.length} / ${slots}</span></h4><table aria-label="${label} player statistics"><thead><tr><th scope="col">Player</th>${headings.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${playerRows||'<tr><td colspan="7" class="sb-empty">Awaiting selections</td></tr>'}</tbody></table></section>`;
  }
  function rosterCard(row){
    return `<article id="season-roster-${esc(row.ownerId)}" class="sb-roster" tabindex="-1"><header><div><p>${esc(row.teamName)}</p><h3>${esc(row.ownerName)}</h3></div><div class="sb-roster-total"><strong>${C.num(row.total)}</strong><span>FPTS</span></div></header>${groups.map(([b,l,n])=>rosterGroup(row.players,b,l,n)).join('')}<button type="button" class="sb-room-link" data-roster-owner="${esc(row.ownerId)}">${esc(row.ownerName)}’s roster room <span aria-hidden="true">↗</span></button></article>`;
  }
  function render(rows,draft){
    const leader=rows[0]?.total||0;
    return `<header class="sb-heading"><div><p class="sb-eyebrow">BASEMENT BAR LEAGUE · ${esc(C.seasonLabel(draft.seasonId))}</p><h1>The season board</h1></div><div class="sb-draft-status"><span>${draft.locked?'● Final rosters locked':`${draft.picks?.length||0} / 60 picks saved`}</span><button type="button" ${draft.locked?'data-view-final-draft':'data-tab="draft"'}>${draft.locked?'View draft record':'Enter draft room'}</button></div></header>
      <section class="sb-standings" aria-labelledby="sb-standings-title"><div class="sb-section-heading"><h2 id="sb-standings-title">League standings</h2><span>Select a manager to see their players</span></div><ol class="sb-ranks">${rows.map(r=>`<li><a id="standing-${esc(r.ownerId)}" href="#season-roster-${esc(r.ownerId)}" data-home-roster="${esc(r.ownerId)}" aria-label="${esc(r.ownerName)}, rank ${r.rank}, ${C.num(r.total)} fantasy points. View roster."><span class="sb-rank">${r.rank.toString().padStart(2,'0')}</span><span class="sb-manager">${esc(r.ownerName)}<small>${C.num(r.total)===leader?'League lead':`${leader-C.num(r.total)} behind`}</small></span><span class="sb-score">${C.num(r.total)}<small>FPTS</small></span></a></li>`).join('')}</ol></section>
      <div class="sb-section-heading sb-rosters-heading"><div><h2>Every roster. Every point.</h2><p>Forwards, defence, then team goalies. Full names and live season totals.</p></div><span>6 F · 4 D · 2 G</span></div><div class="sb-roster-grid">${rows.map(rosterCard).join('')}</div><p class="sb-legend">GP games played · G goals · A assists · SHG shorthanded goals · GWG game-winning goals · W wins · SO shutouts · FPTS fantasy points</p>`;
  }
  return {render,rosterCard,rosterGroup};
});
