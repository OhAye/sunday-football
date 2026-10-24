// Pure stat helpers — no legacy fields, no context dependency.
// AppContext layers the legacy (pre-Supabase) numbers on top of these.
import { pct } from './format'
import { FORMATS, formatForSize } from './constants'

export const hasScore = (a, b) => a !== '' && b !== '' && a != null && b != null

export const motmIdsOf = (session) =>
  Array.isArray(session?.motm) ? session.motm : session?.motm ? [session.motm] : []

// 'A' | 'B' | 'D' | null — which side won a completed match
export function winnerOf(session) {
  if (!session?.result) return null
  const { scoreA, scoreB } = session.result
  if (scoreA === scoreB) return 'D'
  return scoreA > scoreB ? 'A' : 'B'
}

// 'W' | 'D' | 'L' for a player in a session, or null when it can't be determined
// (no result, no lineup, or the player wasn't on either team).
export function outcomeFor(session, playerId) {
  if (!session?.result || !session.teams) return null
  const inA = session.teams.teamA.includes(playerId)
  const inB = session.teams.teamB.includes(playerId)
  if (!inA && !inB) return null
  const winner = winnerOf(session)
  if (winner === 'D') return 'D'
  return (winner === 'A') === inA ? 'W' : 'L'
}

// Appearances and results for one player across a list of sessions
export function tally(playerId, sessionsList) {
  let played = 0, wins = 0, draws = 0, losses = 0
  for (const s of sessionsList) {
    if (!s.playerIds.includes(playerId)) continue
    played++
    const o = outcomeFor(s, playerId)
    if (o === 'W') wins++
    else if (o === 'D') draws++
    else if (o === 'L') losses++
  }
  return { played, wins, draws, losses }
}

export function recordFromSessions(playerId, sessionsList) {
  const t = tally(playerId, sessionsList)
  return { ...t, winPct: pct(t.wins, t.played) }
}

export function motmFromSessions(playerId, sessionsList) {
  return sessionsList.filter((s) => motmIdsOf(s).includes(playerId)).length
}

// Current win / loss run from a chronological list of sessions. A draw resets both.
export function streaksFrom(playerId, chronologicalSessions) {
  let winStreak = 0, lossStreak = 0
  for (const s of chronologicalSessions) {
    const o = outcomeFor(s, playerId)
    if (o === 'W') { winStreak++; lossStreak = 0 }
    else if (o === 'L') { lossStreak++; winStreak = 0 }
    else if (o === 'D') { winStreak = 0; lossStreak = 0 }
  }
  return { winStreak, lossStreak }
}

// Record for two players: when on the same team, and when facing each other (from pA's view)
export function computeH2H(pA, pB, sessions) {
  const same = { played: 0, wins: 0, draws: 0, losses: 0 }
  const opp  = { played: 0, winsA: 0, draws: 0, lossesA: 0 }
  for (const s of sessions) {
    const oA = outcomeFor(s, pA)
    const oB = outcomeFor(s, pB)
    if (!oA || !oB) continue
    const together = s.teams.teamA.includes(pA) === s.teams.teamA.includes(pB)
    if (together) {
      same.played++
      if (oA === 'W') same.wins++
      else if (oA === 'D') same.draws++
      else same.losses++
    } else {
      opp.played++
      if (oA === 'W') opp.winsA++
      else if (oA === 'D') opp.draws++
      else opp.lossesA++
    }
  }
  return { same, opp, total: same.played + opp.played }
}

// Competition-style ranks (1, 2, 2, 4 …) for an already-sorted list
export function rankRows(list, valueOf) {
  let prevVal = null
  let prevRank = 0
  return list.map((item, i) => {
    const v = valueOf(item)
    const rank = prevVal !== null && v === prevVal ? prevRank : i + 1
    prevVal = v
    prevRank = rank
    return { item, rank }
  })
}

// Players per side (7 / 9 / 10). Uses the stored format, or infers it from team sizes for older sessions.
export function formatOf(session) {
  const stored = session?.teams?.format ?? session?.format
  if (FORMATS.includes(stored)) return stored
  return formatForSize(Math.max(session?.teams?.teamA?.length ?? 0, session?.teams?.teamB?.length ?? 0))
}
