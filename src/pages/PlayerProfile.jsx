import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'
import { computeH2H } from '../lib/stats'

const POS_COLOR = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#16a34a', FWD: '#ef4444' }
const POS_BG    = { GK: '#3d2c00', DEF: '#1e3a5f', MID: '#14532d', FWD: '#3d1515' }
const POS_GRAD  = {
  GK:  'linear-gradient(to bottom, #1a1400, #0b0f14)',
  DEF: 'linear-gradient(to bottom, #0c1929, #0b0f14)',
  MID: 'linear-gradient(to bottom, #0f1a12, #0b0f14)',
  FWD: 'linear-gradient(to bottom, #1a0c0c, #0b0f14)',
}

function winColor(pct) {
  if (pct >= 60) return '#16a34a'
  if (pct >= 40) return '#f59e0b'
  return '#ef4444'
}
function winBg(pct) {
  if (pct >= 60) return '#14532d'
  if (pct >= 40) return '#3d2c00'
  return '#2d1515'
}

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players, sessions, sessionsLoaded, getPlayerStats, getMotmCount, getStreaks, getAttendance } = useApp()

  const currentYear = new Date().getFullYear().toString()
  const prevYear    = String(Number(currentYear) - 1)
  const [filterYear, setFilterYear] = useState(currentYear)

  const player = players.find((p) => p.id === id)

  const stats = useMemo(() => {
    if (!player) return null
    const raw = getPlayerStats(id, filterYear === 'all' ? null : filterYear)
    const winPct = raw.played > 0 ? Math.round((raw.wins / raw.played) * 100) : null
    return { ...raw, winPct }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filterYear, sessions])

  const motm = useMemo(
    () => player ? getMotmCount(id, filterYear === 'all' ? null : filterYear) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, filterYear, sessions]
  )

  const streaks    = useMemo(() => getStreaks(id),    [id, sessions])             // eslint-disable-line react-hooks/exhaustive-deps
  const attendance = useMemo(                                                     // eslint-disable-line react-hooks/exhaustive-deps
    () => getAttendance(id, filterYear === 'all' ? null : filterYear),
    [id, filterYear, sessions]                                                    // eslint-disable-line react-hooks/exhaustive-deps
  )

  const lastMatch = useMemo(() => {
    const yearFilter = filterYear === 'all' ? null : filterYear
    const pool = yearFilter ? sessions.filter((s) => s.date?.startsWith(yearFilter)) : sessions
    const played = pool
      .filter((s) => s.playerIds.includes(id) && s.result && s.teams)
      .sort((a, b) => b.date.localeCompare(a.date))
    if (!played.length) return null
    const s = played[0]
    const inA = s.teams.teamA.includes(id)
    const { scoreA, scoreB } = s.result
    const won  = inA ? scoreA > scoreB : scoreB > scoreA
    const lost = inA ? scoreA < scoreB : scoreB < scoreA
    const result = won ? 'W' : lost ? 'L' : 'D'
    const score = inA ? `${scoreA} - ${scoreB}` : `${scoreB} - ${scoreA}`
    return { date: s.date, score, result }
  }, [id, filterYear, sessions])  // eslint-disable-line react-hooks/exhaustive-deps

  const h2hSessions = useMemo(
    () => filterYear === 'all' ? sessions : sessions.filter((s) => s.date?.startsWith(filterYear)),
    [sessions, filterYear]
  )

  const h2hList = useMemo(() => {
    if (!h2hSessions.length) return []
    return players
      .filter((p) => p.id !== id)
      .map((other) => {
        const h2h = computeH2H(id, other.id, h2hSessions)
        return { other, h2h }
      })
      .filter((x) => x.h2h.total > 0)
      .sort((a, b) => b.h2h.total - a.h2h.total)
  }, [id, players, h2hSessions])

  const nemesisList = useMemo(() => {
    const qualified = h2hList.filter((x) => x.h2h.opp.lossesA >= 3)
    if (!qualified.length) return []
    const max = Math.max(...qualified.map((x) => x.h2h.opp.lossesA))
    return qualified.filter((x) => x.h2h.opp.lossesA === max).map((x) => ({ player: x.other, wins: max }))
  }, [h2hList])

  const preyList = useMemo(() => {
    const qualified = h2hList.filter((x) => x.h2h.opp.winsA >= 3 && x.h2h.opp.winsA > x.h2h.opp.lossesA)
    if (!qualified.length) return []
    const max = Math.max(...qualified.map((x) => x.h2h.opp.winsA))
    return qualified.filter((x) => x.h2h.opp.winsA === max).map((x) => ({ player: x.other, wins: max }))
  }, [h2hList])

  if (!sessionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0b0f14' }}>
        <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#0b0f14' }}>
        <p style={{ color: '#64748b' }}>Player not found</p>
        <button onClick={() => navigate('/players')} className="text-sm" style={{ color: '#16a34a' }}>← Back to Players</button>
      </div>
    )
  }

  const posColor = POS_COLOR[player.position] ?? '#64748b'
  const posBg    = POS_BG[player.position]    ?? '#1c2330'

  const statCells = [
    ['P', stats.played,  '#94a3b8'],
    ['W', stats.wins,    '#22c55e'],
    ['D', stats.draws,   '#94a3b8'],
    ['L', stats.losses,  '#f87171'],
  ]

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-10 pb-5 relative overflow-hidden grain hero-enter" style={{ background: POS_GRAD[player.position] ?? 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-5"
          style={{ color: '#64748b' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size={64} />
          <div className="min-w-0 flex-1">
            <h1
              className="text-3xl font-bold uppercase text-[#f1f5f9] leading-tight"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              {player.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {player.position && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: posBg, color: posColor }}>
                  {player.position}
                </span>
              )}
              {player.number && (
                <span className="text-xs font-bold" style={{ color: '#64748b' }}>#{player.number}</span>
              )}
              {player.injured && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#2d1515', color: '#ef4444' }}>
                  Injured
                </span>
              )}
              {streaks.winStreak >= 3 && stats.played >= 3 && <FireIcon size={14} />}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4 pb-8 pt-2">
        {/* Year filter */}
        <div className="flex gap-2">
          {[['all', 'All Time'], [currentYear, currentYear], [prevYear, prevYear]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterYear(key)}
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                background: filterYear === key ? '#16a34a' : '#141920',
                color:      filterYear === key ? '#fff'    : '#64748b',
                border:     `1px solid ${filterYear === key ? '#16a34a' : '#252d3a'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats card */}
        <div className="rounded-2xl overflow-hidden section-enter" style={{ background: '#141920', border: '1px solid #252d3a', animationDelay: '50ms' }}>
          <div className="grid grid-cols-4 divide-x" style={{ borderBottom: '1px solid #252d3a', borderColor: '#252d3a' }}>
            {statCells.map(([label, val, color], i) => (
              <div key={label} className="py-3 flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>{label}</span>
                <span className="score-num stat-pop" style={{ fontSize: 28, color, animationDelay: `${i * 80}ms` }}>{val}</span>
              </div>
            ))}
          </div>
          {/* W/D/L proportion bar */}
          {stats.played > 0 && (
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #252d3a' }}>
              <div className="flex rounded-full overflow-hidden bar-grow" style={{ height: 6 }}>
                {stats.wins > 0 && (
                  <div style={{ width: `${(stats.wins / stats.played) * 100}%`, background: '#22c55e' }} />
                )}
                {stats.draws > 0 && (
                  <div style={{ width: `${(stats.draws / stats.played) * 100}%`, background: '#64748b' }} />
                )}
                {stats.losses > 0 && (
                  <div style={{ width: `${(stats.losses / stats.played) * 100}%`, background: '#ef4444' }} />
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#252d3a' }}>
            <div className="py-3 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Win %</span>
              {stats.winPct !== null ? (
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full stat-pop" style={{ background: winBg(stats.winPct), color: winColor(stats.winPct), animationDelay: '350ms' }}>
                  {stats.winPct}%
                </span>
              ) : (
                <span className="text-sm" style={{ color: '#334155' }}>—</span>
              )}
            </div>
            <div className="py-3 flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>MOTM</span>
              <span className={`score-num stat-pop${motm > 0 ? ' motm-shimmer' : ''}`} style={{ fontSize: 28, color: motm > 0 ? '#fbbf24' : '#334155', animationDelay: '400ms' }}>
                {motm > 0 ? motm : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Last match */}
        {lastMatch && (
          <div className="rounded-2xl p-4 flex items-center justify-between section-enter" style={{ background: '#141920', border: '1px solid #252d3a', animationDelay: '150ms' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold"
                style={{
                  background: lastMatch.result === 'W' ? '#14532d' : lastMatch.result === 'L' ? '#2d1515' : '#1e293b',
                  color: lastMatch.result === 'W' ? '#22c55e' : lastMatch.result === 'L' ? '#ef4444' : '#94a3b8',
                }}
              >
                {lastMatch.result}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: '#64748b' }}>Last Match</p>
                <p className="text-sm font-bold" style={{ fontFamily: "'Oswald', sans-serif", color: '#f1f5f9' }}>
                  {lastMatch.score}
                </p>
              </div>
            </div>
            <span className="text-xs" style={{ color: '#475569' }}>
              {new Date(lastMatch.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}

        {/* Form, streaks & attendance */}
        {stats.played >= 3 && (streaks.winStreak > 0 || streaks.lossStreak > 0 || attendance.rate !== null) && (
          <div className="rounded-2xl p-4 space-y-3 section-enter" style={{ background: '#141920', border: '1px solid #252d3a', animationDelay: '250ms' }}>
            {/* Form dots */}
            {attendance.last10.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: '#64748b' }}>Form</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px]" style={{ color: '#475569' }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#16a34a' }} /> W
                    </span>
                    <span className="flex items-center gap-1 text-[9px]" style={{ color: '#475569' }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#64748b' }} /> D
                    </span>
                    <span className="flex items-center gap-1 text-[9px]" style={{ color: '#475569' }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /> L
                    </span>
                    <span className="flex items-center gap-1 text-[9px]" style={{ color: '#475569' }}>
                      <span className="font-bold" style={{ fontSize: 8 }}>×</span> —
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {[...attendance.last10].reverse().map((s, i) => {
                    const delay = `${350 + i * 60}ms`
                    if (!s.played) {
                      return (
                        <span
                          key={i}
                          style={{ width: 12, height: 12, fontSize: 10, lineHeight: '12px', color: '#475569', animationDelay: delay }}
                          className="flex items-center justify-center font-bold dot-pop"
                        >×</span>
                      )
                    }
                    const bg = s.result === 'W' ? '#16a34a' : s.result === 'L' ? '#ef4444' : '#64748b'
                    return (
                      <div
                        key={i}
                        className="rounded-full dot-pop"
                        style={{ width: 12, height: 12, background: bg, animationDelay: delay }}
                      />
                    )
                  })}
                </div>
              </div>
            )}
            {/* Streaks */}
            {streaks.winStreak > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: '#16a34a' }}>🔥 Win streak</span>
                <span className="text-sm font-bold" style={{ fontFamily: "'Oswald', sans-serif", color: '#16a34a' }}>
                  {streaks.winStreak} game{streaks.winStreak !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {streaks.lossStreak > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#ef4444' }}><FrostIcon size={13} /> Loss streak</span>
                <span className="text-sm font-bold" style={{ fontFamily: "'Oswald', sans-serif", color: '#ef4444' }}>
                  {streaks.lossStreak} game{streaks.lossStreak !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {/* Attendance */}
            {attendance.rate !== null && (
              <div className="flex items-center justify-between" style={{ borderTop: '1px solid #252d3a', paddingTop: 12 }}>
                <span className="text-xs font-bold" style={{ color: '#64748b' }}>Attendance</span>
                <span
                  className="text-sm font-bold"
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    color: attendance.rate >= 80 ? '#22c55e' : attendance.rate >= 60 ? '#f59e0b' : '#94a3b8',
                  }}
                >
                  {attendance.rate}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nemesis & Prey */}
        {(nemesisList.length > 0 || preyList.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {nemesisList.length > 0 ? (
              <div className="rounded-2xl p-3 space-y-2 section-enter" style={{ background: '#1a0f0f', border: '1px solid #7f1d1d55', animationDelay: '350ms' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>💀 Nemesis</p>
                {nemesisList.map(({ player, wins }) => (
                  <Link key={player.id} to={`/player/${player.id}`} className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar player={player} size={22} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#f1f5f9' }}>{player.name}</p>
                      <p className="text-[10px]" style={{ color: '#ef4444' }}>{wins}W vs you</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div />}
            {preyList.length > 0 ? (
              <div className="rounded-2xl p-3 space-y-2 section-enter" style={{ background: '#0f1a0f', border: '1px solid #16a34a55', animationDelay: '400ms' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#22c55e' }}>👑 Prey</p>
                {preyList.map(({ player, wins }) => (
                  <Link key={player.id} to={`/player/${player.id}`} className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar player={player} size={22} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#f1f5f9' }}>{player.name}</p>
                      <p className="text-[10px]" style={{ color: '#22c55e' }}>{wins}W for you</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div />}
          </div>
        )}

        {/* Head to Head */}
        {h2hList.length > 0 && (
          <div className="rounded-2xl overflow-hidden section-enter" style={{ background: '#141920', border: '1px solid #252d3a', animationDelay: '450ms' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
              <h2
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ fontFamily: "'Oswald', sans-serif", color: '#64748b' }}
              >
                Head to Head
              </h2>
            </div>
            <div
              className="grid px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 72px 72px', borderBottom: '1px solid #252d3a', color: '#334155' }}
            >
              <span>Player</span>
              <span className="text-center">Together</span>
              <span className="text-center">Against</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#252d3a' }}>
              {h2hList.map(({ other, h2h }) => (
                <Link
                  key={other.id}
                  to={`/player/${other.id}`}
                  className="grid px-4 py-2.5 items-center"
                  style={{ gridTemplateColumns: '1fr 72px 72px', background: 'transparent' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar player={other} size={22} />
                    <span className="text-sm font-medium truncate" style={{ color: '#f1f5f9' }}>{other.name}</span>
                  </div>
                  <div className="text-center">
                    {h2h.same.played > 0 ? (
                      <span className="text-xs tabular-nums">
                        <span style={{ color: '#22c55e' }}>{h2h.same.wins}</span>
                        <span style={{ color: '#475569' }}>-{h2h.same.draws}-</span>
                        <span style={{ color: '#f87171' }}>{h2h.same.losses}</span>
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#334155' }}>—</span>
                    )}
                  </div>
                  <div className="text-center">
                    {h2h.opp.played > 0 ? (
                      <span className="text-xs tabular-nums">
                        <span style={{ color: '#22c55e' }}>{h2h.opp.winsA}</span>
                        <span style={{ color: '#475569' }}>-{h2h.opp.draws}-</span>
                        <span style={{ color: '#f87171' }}>{h2h.opp.lossesA}</span>
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#334155' }}>—</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
