// Pure stat helpers — no legacy fields, no context dependency.
// Used by Stats.jsx (Last N filter) and PlayerProfile.jsx (H2H).

export function recordFromSessions(playerId, sessionsList) {
  let played = 0, wins = 0, draws = 0, losses = 0
  for (const s of sessionsList) {
    if (!s.playerIds.includes(playerId)) continue
    played++
    if (!s.result || !s.teams) continue
    const inA = s.teams.teamA.includes(playerId)
    const inB = s.teams.teamB.includes(playerId)
    const { scoreA, scoreB } = s.result
    if (inA) { if (scoreA > scoreB) wins++; else if (scoreA === scoreB) draws++; else losses++ }
    else if (inB) { if (scoreB > scoreA) wins++; else if (scoreB === scoreA) draws++; else losses++ }
  }
  return { played, wins, draws, losses, winPct: played > 0 ? Math.round((wins / played) * 100) : null }
}

export function motmFromSessions(playerId, sessionsList) {
  return sessionsList.filter((s) => {
    const ids = Array.isArray(s.motm) ? s.motm : (s.motm ? [s.motm] : [])
    return ids.includes(playerId)
  }).length
}

export function computeH2H(pA, pB, sessions) {
  const both = sessions.filter((s) =>
    s.playerIds.includes(pA) && s.playerIds.includes(pB) && s.result && s.teams
  )
  const same = { played: 0, wins: 0, draws: 0, losses: 0 }
  const opp  = { played: 0, winsA: 0, draws: 0, lossesA: 0 }
  for (const s of both) {
    const { scoreA, scoreB } = s.result
    const aInA = s.teams.teamA.includes(pA)
    const bInA = s.teams.teamA.includes(pB)
    if (aInA === bInA) {
      same.played++
      const win = aInA ? scoreA > scoreB : scoreB > scoreA
      if (scoreA === scoreB) same.draws++
      else if (win) same.wins++
      else same.losses++
    } else {
      opp.played++
      const aWon = aInA ? scoreA > scoreB : scoreB > scoreA
      if (scoreA === scoreB) opp.draws++
      else if (aWon) opp.winsA++
      else opp.lossesA++
    }
  }
  return { total: both.length, same, opp }
}
