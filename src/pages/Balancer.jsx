import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

function TeamCard({ team, teamIds, avg, ratings, playerMap, onEdit }) {
  const isA = team === 'A'
  const colors = isA
    ? { bg: '#0f1a12', border: '#16a34a55', label: '#22c55e', badgeBg: '#14532d', hint: '#16a34a55' }
    : { bg: '#0e1828', border: '#3b82f655', label: '#60a5fa', badgeBg: '#1e3a5f', hint: '#3b82f655' }

  return (
    <button
      onClick={onEdit}
      className="rounded-2xl p-4 text-left transition-opacity active:opacity-70"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: "'Oswald', sans-serif", color: colors.label }}
        >
          Team {team}
        </p>
        <span
          className="text-xs font-bold rounded-lg px-2 py-0.5"
          style={{ background: colors.badgeBg, color: colors.label }}
        >
          {avg}%
        </span>
      </div>
      <div className="space-y-2">
        {teamIds.map((id) => (
          <Link key={id} to={`/player/${id}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: '#f1f5f9' }}>{playerMap[id]?.name}</span>
            <span className="text-[10px]" style={{ color: '#64748b' }}>{ratings[id]}%</span>
          </Link>
        ))}
      </div>
      <p className="text-[10px] mt-3 text-center" style={{ color: colors.hint }}>tap to edit</p>
    </button>
  )
}

export default function Balancer() {
  const { players, sessionsLoaded, getPlayerStats, saveMatch } = useApp()
  const navigate = useNavigate()

  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [selected, setSelected] = useState([])
  const [result, setResult] = useState(null)
  const [editingTeams, setEditingTeams] = useState(false)
  const [saving, setSaving] = useState(false)

  // Compute all ratings once — getPlayerStats iterates sessions, so this avoids O(N²) calls
  const ratings = useMemo(() => {
    const map = {}
    for (const p of players) {
      const s = getPlayerStats(p.id, null)
      map[p.id] = s.played < 5 ? 50 : Math.round((s.wins / s.played) * 100)
    }
    return map
  }, [players, getPlayerStats])

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  )

  const activePlayers = useMemo(
    () => [...players].filter((p) => !p.injured).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  )

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const selectedPlayers = useMemo(
    () => activePlayers.filter((p) => selectedSet.has(p.id)),
    [activePlayers, selectedSet]
  )

  const teamASet = useMemo(() => new Set(result?.teamA ?? []), [result])

  function teamAvg(ids) {
    if (!ids.length) return 0
    return Math.round(ids.reduce((acc, id) => acc + ratings[id], 0) / ids.length)
  }

  function greedySplit(orderedIds) {
    const teamA = [], teamB = []
    let sumA = 0, sumB = 0
    for (const id of orderedIds) {
      const r = ratings[id]
      if (sumA <= sumB) { teamA.push(id); sumA += r }
      else { teamB.push(id); sumB += r }
    }
    return { teamA, teamB, avgA: teamAvg(teamA), avgB: teamAvg(teamB) }
  }

  function balance() {
    const sorted = [...selected].sort((a, b) => ratings[b] - ratings[a])
    setResult(greedySplit(sorted))
    setEditingTeams(false)
  }

  function shuffleBalance() {
    const jittered = selected
      .map((id) => ({ id, key: ratings[id] + (Math.random() * 14 - 7) }))
      .sort((a, b) => b.key - a.key)
      .map((x) => x.id)
    setResult(greedySplit(jittered))
    setEditingTeams(false)
  }

  function togglePlayer(id) {
    setSelected((prev) => selectedSet.has(id) ? prev.filter((x) => x !== id) : [...prev, id])
    setResult(null)
    setEditingTeams(false)
  }

  function swapPlayer(id) {
    setResult((prev) => {
      const inA = teamASet.has(id)
      const newA = inA ? prev.teamA.filter((x) => x !== id) : [...prev.teamA, id]
      const newB = inA ? [...prev.teamB, id] : prev.teamB.filter((x) => x !== id)
      return { teamA: newA, teamB: newB, avgA: teamAvg(newA), avgB: teamAvg(newB) }
    })
  }

  async function handleCreate() {
    if (!result || saving) return
    setSaving(true)
    await saveMatch({ date, teamA: result.teamA, teamB: result.teamB, scoreA: '', scoreB: '' })
    setSaving(false)
    navigate('/lineups')
  }

  if (!sessionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0b0f14' }}>
        <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-10 pb-5 relative overflow-hidden grain hero-enter" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Sunday FC</p>
        <h1
          className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          Teams
        </h1>
      </header>

      <div className="px-4 space-y-4 pb-8 pt-2">
        <div className="rounded-2xl p-4 space-y-2 overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <label className="text-[10px] uppercase tracking-widest font-semibold block" style={{ color: '#64748b' }}>
            Match Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            style={{ background: '#1c2330', border: '1px solid #252d3a', color: '#f1f5f9' }}
          />
        </div>

        <div className="rounded-2xl p-4 space-y-3" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#64748b' }}>
            Who's Playing?{' '}
            <span style={{ color: '#334155' }}>({selected.length} selected)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {activePlayers.map((p) => {
              const sel = selectedSet.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: sel ? '#16a34a' : '#1c2330',
                    color: sel ? '#fff' : '#64748b',
                    border: `1px solid ${sel ? '#16a34a' : '#252d3a'}`,
                  }}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>

        {selected.length >= 12 ? (
          <div className="flex gap-2">
            <button
              onClick={balance}
              className="flex-1 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider"
              style={{
                fontFamily: "'Oswald', sans-serif",
                background: '#16a34a',
                color: '#fff',
                boxShadow: '0 0 16px #16a34a44',
              }}
            >
              Suggest Teams
            </button>
            {result && (
              <button
                onClick={shuffleBalance}
                className="px-5 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  background: '#1c2330',
                  color: '#64748b',
                  border: '1px solid #252d3a',
                }}
              >
                Shuffle
              </button>
            )}
          </div>
        ) : (
          selected.length > 0 && (
            <p className="text-xs text-center" style={{ color: '#334155' }}>
              Select at least 12 players ({12 - selected.length} more needed)
            </p>
          )
        )}

        {result && (
          <>
            {selected.length % 2 === 1 && (
              <p className="text-xs text-center font-bold" style={{ color: '#f59e0b' }}>
                Odd number — one team gets the extra player
              </p>
            )}

            {editingTeams ? (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
                    Tap a player to switch teams
                  </p>
                  <button
                    onClick={() => setEditingTeams(false)}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl"
                    style={{ background: '#16a34a', color: '#fff' }}
                  >
                    Done
                  </button>
                </div>

                <div className="divide-y" style={{ borderColor: '#252d3a' }}>
                  {selectedPlayers.map((p) => {
                    const inA = teamASet.has(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => swapPlayer(p.id)}
                        className="w-full flex items-center justify-between px-4 py-3 active:opacity-70"
                      >
                        <Link to={`/player/${p.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{p.name}</Link>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: '#64748b' }}>{ratings[p.id]}%</span>
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-lg"
                            style={
                              inA
                                ? { background: '#14532d', color: '#22c55e' }
                                : { background: '#1e3a5f', color: '#60a5fa' }
                            }
                          >
                            {inA ? 'A' : 'B'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="flex" style={{ borderTop: '1px solid #252d3a' }}>
                  <div className="flex-1 py-2.5 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>
                      Team A · {result.avgA}%
                    </span>
                  </div>
                  <div className="w-px" style={{ background: '#252d3a' }} />
                  <div className="flex-1 py-2.5 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                      Team B · {result.avgB}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <TeamCard
                  team="A"
                  teamIds={result.teamA}
                  avg={result.avgA}
                  ratings={ratings}
                  playerMap={playerMap}
                  onEdit={() => setEditingTeams(true)}
                />
                <TeamCard
                  team="B"
                  teamIds={result.teamB}
                  avg={result.avgB}
                  ratings={ratings}
                  playerMap={playerMap}
                  onEdit={() => setEditingTeams(true)}
                />
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-60"
              style={{
                fontFamily: "'Oswald', sans-serif",
                background: '#16a34a',
                color: '#fff',
                boxShadow: '0 0 20px #16a34a55',
              }}
            >
              {saving ? 'Creating…' : 'Create Match with These Teams'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
