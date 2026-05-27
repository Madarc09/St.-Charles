export function fantasyPoints(player, scoring = {}) {
  const p = player || {};
  const s = scoring || {};
  const skaterTotal =
    (Number(p.goals || 0) * Number(s.goals || 0)) +
    (Number(p.assists || 0) * Number(s.assists || 0)) +
    (Number(p.points || 0) * Number(s.points || 0)) +
    (Number(p.powerPlayGoals || 0) * Number(s.powerPlayGoals || 0)) +
    (Number(p.powerPlayPoints || 0) * Number(s.powerPlayPoints || 0)) +
    (Number(p.shortHandedGoals || 0) * Number(s.shortHandedGoals || 0)) +
    (Number(p.gameWinningGoals || 0) * Number(s.gameWinningGoals || 0)) +
    (Number(p.shots || 0) * Number(s.shots || 0)) +
    (Number(p.hits || 0) * Number(s.hits || 0)) +
    (Number(p.blocks || 0) * Number(s.blocks || 0));
  const goalieTotal =
    (Number(p.goalieWins || 0) * Number(s.goalieWins || 0)) +
    (Number(p.goalieShutouts || 0) * Number(s.goalieShutouts || 0)) +
    (Number(p.goalieSaves || 0) * Number(s.goalieSaves || 0)) +
    (Number(p.goalieGoalsAgainst || 0) * Number(s.goalieGoalsAgainst || 0)) +
    (Number(p.goalieSavePct || 0) * Number(s.goalieSavePctBonus || 0));
  return Math.round((skaterTotal + goalieTotal) * 100) / 100;
}

export function ownerTotal(ownerId, state) {
  const roster = state.rosters[ownerId] || [];
  return roster.reduce((sum, playerRef) => {
    const current = state.stats.players.find(p => String(p.id) === String(playerRef.id)) || playerRef;
    return sum + fantasyPoints({ ...playerRef, ...current }, state.settings.scoring);
  }, 0);
}
