import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AppContext } from './app-context'
import { MIN_STREAK_GAMES, STREAK_BADGE, formatForSize } from '../lib/constants'
import { currentYear, fmtDate, slugify, todayYMD } from '../lib/format'
import { hasScore, motmIdsOf, outcomeFor, streaksFrom, tally } from '../lib/stats'
import { scoreLine } from '../lib/share'
import { fetchWeatherForDate } from '../lib/weather'

const ADMIN_FLAG = 'sf_admin' // sessionStorage: admin stays unlocked until the tab closes
const LEGACY_YEARS = ['2025', '2026'] // 2024 legacy P/W/L is excluded (inaccurate data)

// ─── DB mapping helpers ──────────────────────────────────────────
function sessionToDb(s) {
  return {
    id: s.id,
    date: s.date,
    player_ids: s.playerIds ?? [],
    teams: s.teams ?? null,
    result: s.result ?? null,
    motm: s.motm ?? null,           // TEXT[] in DB
    report: s.report ?? null,
    weather: s.weather ?? null,     // JSONB { code, tempC, windKph }
    written_by: s.writtenBy ?? null,
    created_at: s.createdAt ?? new Date().toISOString(),
  }
}

// Usman G joined later; bare 'h-usman' (pre-distinction) belongs to Usman A
const remapPlayerId = (id) => (id === 'h-usman' ? 'h-usmana' : id)

function dbToSession(row) {
  const teams = row.teams
    ? {
        teamA: (row.teams.teamA ?? []).map(remapPlayerId),
        teamB: (row.teams.teamB ?? []).map(remapPlayerId),
        ...(row.teams.format ? { format: row.teams.format } : {}),
      }
    : null
  const motm = motmIdsOf(row).map(remapPlayerId)
  return {
    id: row.id,
    date: row.date,
    playerIds: (row.player_ids ?? []).map(remapPlayerId),
    teams,
    result: row.result,
    motm: motm.length ? motm : null,    // string[] | null
    report: row.report ?? null,
    weather: row.weather ?? null,       // { code, tempC, windKph } | null
    writtenBy: row.written_by ?? null,  // player ID | null
    createdAt: row.created_at,
  }
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date)

// ─── First-run seeding (only when the Supabase tables are empty) ──
async function seedPlayers() {
  const { initialPlayers, migratePlayers } = await import('../data/seedPlayers')
  // Prefer pre-Supabase localStorage data — it preserves custom positions/edits
  const localRaw = localStorage.getItem('sf_players')
  const migrated = migratePlayers(localRaw ? JSON.parse(localRaw) : initialPlayers)
  const { error } = await supabase.from('players').insert(migrated.map((p) => ({ id: p.id, data: p })))
  if (error) console.error('Failed to seed players to Supabase:', error)
  else localStorage.removeItem('sf_players')
  return migrated
}

// Partial-lineup corrections applied to the historical log before seeding
const SESSION_FIXES = {
  '97901eeb-1a20-40fb-a9ce-a2b83b149d2d': {
    playerIds: ['h-ali', 'h-usmang', 'h-shez', 'h-zeshan', 'h-raza'],
    teams: { teamA: ['h-ali', 'h-usmang'], teamB: ['h-shez', 'h-zeshan', 'h-raza'] },
  },
  '21becac1-f819-43cd-9a46-589798f42a8b': {
    playerIds: ['h-shez', 'h-ali', 'h-tommy', 'h-emre', 'h-shabaz', 'h-tony', 'h-omar', 'h-saqa', 'h-saqy'],
    teams: { teamA: ['h-shez', 'h-ali', 'h-tommy', 'h-emre', 'h-shabaz', 'h-tony'], teamB: ['h-omar', 'h-saqa', 'h-saqy'] },
  },
  'ff271829-48bc-4348-8d70-0b0b2e45f0e2': {
    playerIds: ['h-shez', 'h-ali', 'h-tommy', 'h-matt', 'h-zeshan', 'h-omar'],
    teams: { teamA: ['h-shez', 'h-ali', 'h-tommy', 'h-matt'], teamB: ['h-zeshan', 'h-omar'] },
  },
}

async function seedSessions() {
  const localRaw = localStorage.getItem('sf_sessions')
  let source = localRaw ? JSON.parse(localRaw) : (await import('../data/historicalSessions')).historicalSessions
  source = source
    .map((s) => {
      const fix = SESSION_FIXES[s.id]
      return fix && (s.playerIds?.length ?? 0) < fix.playerIds.length
        ? { ...s, playerIds: fix.playerIds, teams: fix.teams }
        : s
    })
    .map((s) => {
      // scoreKnown backfill: a 1–0 placeholder means "winner known, score not recorded"
      if (!s.result || s.result.scoreKnown !== undefined) return s
      const { scoreA, scoreB } = s.result
      return { ...s, result: { ...s.result, scoreKnown: scoreA + scoreB > 1 } }
    })
    .sort(byDateDesc)
  const { error } = await supabase.from('sessions').insert(source.map(sessionToDb))
  if (error) console.error('Failed to seed sessions to Supabase:', error)
  else localStorage.removeItem('sf_sessions')
  return source
}

// { playerId: votes } for a session's MOTM ballot, or null if the tally couldn't be loaded
async function getVoteCounts(sessionId) {
  const { data, error } = await supabase.from('motm_votes').select('voted_for').eq('session_id', sessionId)
  if (error) return null
  const counts = {}
  for (const { voted_for } of data) counts[voted_for] = (counts[voted_for] || 0) + 1
  return counts
}

function readAdminFlag() {
  try { return sessionStorage.getItem(ADMIN_FLAG) === '1' } catch { return false }
}
function writeAdminFlag(on) {
  try {
    if (on) sessionStorage.setItem(ADMIN_FLAG, '1')
    else sessionStorage.removeItem(ADMIN_FLAG)
  } catch { /* storage unavailable (private mode) */ }
}

export function AppProvider({ children }) {
  const [players, setPlayers] = useState([])
  const [playersLoaded, setPlayersLoaded] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [adminPin, setAdminPin] = useState(null) // loaded from Supabase
  const [isAdmin, setIsAdmin] = useState(readAdminFlag)

  // ── Load admin PIN ──
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'admin_pin').single()
      .then(({ data }) => { if (data?.value) setAdminPin(data.value) })
  }, [reloadKey])

  // ── Load players (seeds on first run) ──
  useEffect(() => {
    let cancelled = false
    async function loadPlayers() {
      const { data: existing, error } = await supabase.from('players').select('*')
      let next
      if (error) {
        console.error('Failed to load players:', error)
        next = (await import('../data/seedPlayers')).initialPlayers
      } else if (existing.length > 0) {
        // Drop the bare 'h-usman' row if present — Usman A (h-usmana) is the correct entry
        next = existing.map((r) => r.data).filter((p) => p.id !== 'h-usman')
      } else {
        next = await seedPlayers()
      }
      if (cancelled) return
      if (error) setLoadError(true)
      setPlayers(next)
      setPlayersLoaded(true)
    }
    loadPlayers()
    return () => { cancelled = true }
  }, [reloadKey])

  // ── Load sessions (seeds on first run) ──
  useEffect(() => {
    let cancelled = false
    async function loadSessions() {
      const { data: existing, error } = await supabase
        .from('sessions').select('*').order('date', { ascending: false })
      let next = []
      if (error) console.error('Failed to load sessions:', error)
      else if (existing.length > 0) next = existing.map(dbToSession)
      else next = await seedSessions()
      if (cancelled) return
      if (error) setLoadError(true)
      setSessions(next)
      setSessionsLoaded(true)
    }
    loadSessions()
    return () => { cancelled = true }
  }, [reloadKey])

  function reload() {
    setLoadError(false)
    setPlayersLoaded(false)
    setSessionsLoaded(false)
    setReloadKey((k) => k + 1)
  }

  // ─── Players ───────────────────────────────────────────────────
  // All writes hit Supabase first; local state only changes on success.
  // Creators return the new record (or null); updaters return true/false.

  async function addPlayer({ name, position, number }) {
    const trimmed = name.trim()
    // IDs follow h-{name}; a numeric suffix keeps them unique
    const base = slugify(trimmed) ? `h-${slugify(trimmed)}` : crypto.randomUUID()
    let id = base
    for (let n = 2; players.some((p) => p.id === id); n++) id = `${base}${n}`
    const player = {
      id,
      name: trimmed,
      position: position ?? 'MID',
      number: number ? Number(number) : null,
      createdAt: new Date().toISOString(),
      legacyMotm: 0,
    }
    const { error } = await supabase.from('players').insert({ id: player.id, data: player })
    if (error) { console.error('addPlayer failed:', error); return null }
    setPlayers((prev) => [...prev, player])
    return player
  }

  async function updatePlayer(id, updates) {
    const current = players.find((p) => p.id === id)
    if (!current) return false
    const updated = { ...current, ...updates }
    const { error } = await supabase.from('players').update({ data: updated }).eq('id', id)
    if (error) { console.error('updatePlayer failed:', error); return false }
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return true
  }

  async function removePlayer(id) {
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) { console.error('removePlayer failed:', error); return false }
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    return true
  }

  // ─── Sessions ──────────────────────────────────────────────────

  async function saveMatch({ date, teamA, teamB, scoreA, scoreB, format }) {
    const scored = hasScore(scoreA, scoreB)
    const session = {
      id: crypto.randomUUID(),
      date,
      playerIds: [...new Set([...teamA, ...teamB])],
      teams: { teamA, teamB, format: format ?? formatForSize(Math.max(teamA.length, teamB.length)) },
      result: scored ? { scoreA: Number(scoreA), scoreB: Number(scoreB), scoreKnown: true } : null,
      motm: null,
      weather: scored ? await fetchWeatherForDate(date) : null,
      createdAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('sessions').insert(sessionToDb(session))
    if (error) { console.error('saveMatch failed:', error); return null }
    setSessions((prev) => [session, ...prev].sort(byDateDesc))
    return session
  }

  async function updateSession(id, updates) {
    const current = sessions.find((s) => s.id === id)
    if (!current) return false
    const merged = { ...current, ...updates }
    // Auto-fetch weather the first time a result is saved
    if (updates.result && !merged.weather) {
      merged.weather = await fetchWeatherForDate(merged.date)
    }
    const { error } = await supabase.from('sessions').update(sessionToDb(merged)).eq('id', id)
    if (error) { console.error('updateSession failed:', error); return false }
    setSessions((prev) => prev.map((s) => (s.id === id ? merged : s)).sort(byDateDesc))
    return true
  }

  async function removeSession(id) {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) { console.error('removeSession failed:', error); return false }
    setSessions((prev) => prev.filter((s) => s.id !== id))
    return true
  }

  async function importHistoricalSessions() {
    const { historicalSessions } = await import('../data/historicalSessions')
    const { data: existing, error: readError } = await supabase.from('sessions').select('date')
    if (readError) return false
    const existingDates = new Set((existing ?? []).map((r) => r.date))
    const toAdd = historicalSessions.filter((s) => !existingDates.has(s.date))
    if (toAdd.length > 0) {
      const { error } = await supabase.from('sessions').insert(toAdd.map(sessionToDb))
      if (error) { console.error('import failed:', error); return false }
      setSessions((prev) => [...prev, ...toAdd].sort(byDateDesc))
    }
    // Zero out legacy W/L/played (sessions now cover that period); keep MOTM
    const updatedPlayers = players.map((p) => ({
      ...p,
      legacyPlayed: 0, legacyWins: 0, legacyLosses: 0, legacyDraws: 0,
      legacyPlayed2024: 0, legacyWins2024: 0, legacyLosses2024: 0,
      legacyPlayed2025: 0, legacyWins2025: 0, legacyLosses2025: 0,
      legacyPlayed2026: 0, legacyWins2026: 0, legacyLosses2026: 0,
    }))
    const { error } = await supabase.from('players').upsert(updatedPlayers.map((p) => ({ id: p.id, data: p })))
    if (error) { console.error('legacy reset failed:', error); return false }
    setPlayers(updatedPlayers)
    return true
  }

  // ─── MOTM voting ───────────────────────────────────────────────

  // Publish (or refresh) the public ballot the /vote/:id page reads
  async function publishVote(session) {
    const votePlayers = session.playerIds.map((id) => {
      const p = players.find((pl) => pl.id === id)
      return { id, name: p?.name ?? 'Unknown', avatarUrl: p?.avatarUrl ?? null }
    })
    const { error } = await supabase.from('vote_sessions').upsert(
      { session_id: session.id, date: fmtDate(session.date), score_label: scoreLine(session), players: votePlayers },
      { onConflict: 'session_id' },
    )
    if (error) console.error('publishVote failed:', error)
    return !error
  }

  // ─── Admin ─────────────────────────────────────────────────────

  function unlockAdmin(pin) {
    if (adminPin === null || pin !== adminPin) return false
    setIsAdmin(true)
    writeAdminFlag(true)
    return true
  }
  function lockAdmin() {
    setIsAdmin(false)
    writeAdminFlag(false)
  }
  async function changePin(newPin) {
    const { error } = await supabase.from('settings').update({ value: newPin }).eq('key', 'admin_pin')
    if (error) { console.error('changePin failed:', error); return false }
    setAdminPin(newPin)
    return true
  }

  // ─── Derived data ──────────────────────────────────────────────

  // 2024 sessions are excluded everywhere — that data is inaccurate; only 2025+ counts
  const visibleSessions = useMemo(
    () => sessions.filter((s) => !s.date?.startsWith('2024')),
    [sessions],
  )

  // Sessions that count towards stats. An upcoming fixture (no result yet, today or later)
  // is not an appearance — otherwise everyone in next Sunday's lineup gains a game and a loss.
  const countedSessions = useMemo(() => {
    const today = todayYMD()
    return visibleSessions.filter((s) => s.result || s.date < today)
  }, [visibleSessions])

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const getMotmCount = useCallback((playerId, year = null) => {
    const sessionCount = visibleSessions.filter(
      (s) => motmIdsOf(s).includes(playerId) && (year === null || s.date?.startsWith(year)),
    ).length
    const player = playerById.get(playerId)
    const legacy = year !== null ? player?.[`legacyMotm${year}`] : player?.legacyMotm
    return sessionCount + (legacy ?? 0)
  }, [visibleSessions, playerById])

  const getPlayerStats = useCallback((playerId, year = null) => {
    const pool = year === null ? countedSessions : countedSessions.filter((s) => s.date?.startsWith(year))
    const { played, wins, draws, losses } = tally(playerId, pool)
    const player = playerById.get(playerId)

    // Season view: session data + that year's legacy fields
    if (year !== null) {
      const totalPlayed = played + (player?.[`legacyPlayed${year}`] ?? 0)
      const totalWins = wins + (player?.[`legacyWins${year}`] ?? 0)
      return { played: totalPlayed, wins: totalWins, draws, losses: Math.max(0, totalPlayed - totalWins - draws) }
    }

    // All time: sessions + all legacy fields, so the number matches the sum of the seasons
    const legacySum = (field) =>
      (player?.[field] ?? 0) + LEGACY_YEARS.reduce((acc, y) => acc + (player?.[`${field}${y}`] ?? 0), 0)
    const totalPlayed = played + legacySum('legacyPlayed')
    const totalWins = wins + legacySum('legacyWins')
    const totalDraws = draws + (player?.legacyDraws ?? 0)
    const legacyLosses = legacySum('legacyLosses')
    return {
      played: totalPlayed,
      wins: totalWins,
      draws: totalDraws,
      losses: legacyLosses > 0 ? losses + legacyLosses : totalPlayed - totalWins - totalDraws,
    }
  }, [countedSessions, playerById])

  // Current-season results in chronological order (streaks are always current season)
  const seasonChronological = useMemo(() => {
    const year = currentYear()
    return countedSessions
      .filter((s) => s.date?.startsWith(year) && s.result && s.teams)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [countedSessions])

  const getStreaks = useCallback(
    (playerId) => streaksFrom(playerId, seasonChronological),
    [seasonChronological],
  )

  // Attendance rate. With a year: share of that season's sessions. Without: share since debut.
  // `last10` is newest-first: { date, played, result: 'W' | 'D' | 'L' | null }
  const getAttendance = useCallback((playerId, year = null) => {
    const pool = year ? countedSessions.filter((s) => s.date?.startsWith(year)) : countedSessions
    const mine = pool.filter((s) => s.playerIds.includes(playerId))
    if (mine.length === 0) return { rate: null, played: 0, totalSince: 0, last10: [] }
    let since = pool
    if (!year) {
      const debut = mine.reduce((min, s) => (s.date < min ? s.date : min), mine[0].date)
      since = pool.filter((s) => s.date >= debut)
    }
    const last10 = [...since].sort(byDateDesc).slice(0, 10).map((s) => {
      const played = s.playerIds.includes(playerId)
      return { date: s.date, played, result: played ? outcomeFor(s, playerId) : null }
    })
    return {
      rate: Math.round((mine.length / since.length) * 100),
      played: mine.length,
      totalSince: since.length,
      last10,
    }
  }, [countedSessions])

  // Players on a 3+ win (fire) or loss (frost) run this season
  const { firePlayerIds, frostPlayerIds } = useMemo(() => {
    const year = currentYear()
    const fire = new Set(), frost = new Set()
    for (const p of players) {
      if (getPlayerStats(p.id, year).played < MIN_STREAK_GAMES) continue
      const { winStreak, lossStreak } = getStreaks(p.id)
      if (winStreak >= STREAK_BADGE) fire.add(p.id)
      if (lossStreak >= STREAK_BADGE) frost.add(p.id)
    }
    return { firePlayerIds: fire, frostPlayerIds: frost }
  }, [players, getPlayerStats, getStreaks])

  const value = {
    players,
    playerById,
    sessions: visibleSessions,        // everything shown in the app (includes upcoming fixtures)
    playedSessions: countedSessions,  // the subset that counts towards stats
    sessionsLoaded: sessionsLoaded && playersLoaded,
    loadError,
    reload,
    isAdmin,
    adminReady: adminPin !== null,
    unlockAdmin,
    lockAdmin,
    changePin,
    addPlayer,
    updatePlayer,
    removePlayer,
    saveMatch,
    updateSession,
    removeSession,
    importHistoricalSessions,
    fetchWeatherForDate,
    publishVote,
    getVoteCounts,
    getMotmCount,
    getPlayerStats,
    getStreaks,
    getAttendance,
    firePlayerIds,
    frostPlayerIds,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
