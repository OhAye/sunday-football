import { createContext, useContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const AppContext = createContext(null)

const initialPlayers = []
const initialSessions = []

export function AppProvider({ children }) {
  const [players, setPlayers] = useLocalStorage('sf_players', initialPlayers)
  const [sessions, setSessions] = useLocalStorage('sf_sessions', initialSessions)

  function addPlayer({ name, position, number }) {
    const player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      position: position ?? 'MID',
      number: number ? Number(number) : null,
      createdAt: new Date().toISOString(),
    }
    setPlayers((prev) => [...prev, player])
    return player
  }

  function updatePlayer(id, updates) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  function addSession(date, playerIds) {
    const session = {
      id: crypto.randomUUID(),
      date,
      playerIds,
      teams: null,
      result: null,
      createdAt: new Date().toISOString(),
    }
    setSessions((prev) => [session, ...prev])
    return session
  }

  // Save a fully-formed match (teams + optional result) in one call
  function saveMatch({ date, teamA, teamB, scoreA, scoreB, goals }) {
    const playerIds = [...new Set([...teamA, ...teamB])]
    const hasScore = scoreA !== '' && scoreB !== '' && scoreA != null && scoreB != null
    const session = {
      id: crypto.randomUUID(),
      date,
      playerIds,
      teams: { teamA, teamB },
      result: hasScore ? { scoreA: Number(scoreA), scoreB: Number(scoreB), goals: goals ?? {} } : null,
      createdAt: new Date().toISOString(),
    }
    setSessions((prev) => [session, ...prev])
    return session
  }

  function updateSession(id, updates) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  function removeSession(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  function getMotmCount(playerId) {
    return sessions.filter((s) => s.motm === playerId).length
  }

  function getPlayerStats(playerId) {
    const played = sessions.filter((s) => s.playerIds.includes(playerId))
    let wins = 0, draws = 0, losses = 0, goals = 0

    for (const session of played) {
      if (!session.result || !session.teams) continue
      const inTeamA = session.teams.teamA.includes(playerId)
      const inTeamB = session.teams.teamB.includes(playerId)
      const { scoreA, scoreB } = session.result
      const playerGoals = session.result.goals?.[playerId] ?? 0
      goals += playerGoals
      if (inTeamA) {
        if (scoreA > scoreB) wins++
        else if (scoreA === scoreB) draws++
        else losses++
      } else if (inTeamB) {
        if (scoreB > scoreA) wins++
        else if (scoreB === scoreA) draws++
        else losses++
      }
    }

    return { played: played.length, wins, draws, losses, goals }
  }

  return (
    <AppContext.Provider
      value={{
        players,
        sessions,
        addPlayer,
        updatePlayer,
        removePlayer,
        addSession,
        saveMatch,
        updateSession,
        removeSession,
        getMotmCount,
        getPlayerStats,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
