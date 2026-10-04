import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useApp } from '../context/AppContext'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'
import { recordFromSessions, motmFromSessions, computeH2H } from '../lib/stats'

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

// ─── page ───────────────────────────────────────────────────────
export default function Stats() {
  const { players, sessions, sessionsLoaded, getPlayerStats, getMotmCount, getStreaks } = useApp()
  const [filterMode, setFilterMode] = useState('all')   // 'all' | year string | 'last10' | 'last20'
  const [sortCol, setSortCol] = useState('winPct')
  const [sortDir, setSortDir] = useState('desc')

  const isLastN   = filterMode === 'last10' || filterMode === 'last20'
  const lastNCount = filterMode === 'last10' ? 10 : 20
  const currentYear = new Date().getFullYear().toString()

  const firePlayerIds = useMemo(() => {
    return new Set(players.filter((p) => getPlayerStats(p.id, currentYear).played >= 3 && getStreaks(p.id).winStreak >= 3).map((p) => p.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, sessions])

  const frostPlayerIds = useMemo(() => {
    return new Set(players.filter((p) => getPlayerStats(p.id, currentYear).played >= 3 && getStreaks(p.id).lossStreak >= 3).map((p) => p.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, sessions])

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  // Derive available filter options
  const filterOptions = useMemo(() => {
    const currentYear = new Date().getFullYear().toString()
    const years = new Set(sessions.map((s) => s.date?.slice(0, 4)).filter(Boolean))
    years.delete('2024')
    years.add('2025')
    years.add(currentYear)
    const yearOpts = Array.from(years).sort((a, b) => b - a).map((y) => ({ key: y, label: `${y} Season` }))
    return [
      { key: 'all', label: 'All Time' },
      ...yearOpts,
      { key: 'last10', label: 'Last 10' },
      { key: 'last20', label: 'Last 20' },
    ]
  }, [sessions])

  const filteredSessions = useMemo(() => {
    if (filterMode === 'all') return sessions
    if (isLastN) return [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, lastNCount)
    return sessions.filter((s) => s.date?.startsWith(filterMode))
  }, [sessions, filterMode, isLastN, lastNCount])

  const completedSessions = filteredSessions.filter((s) => s.result)

  const MIN_GAMES = 5
  const RANKED_MIN = filterMode === 'all' ? 10 : MIN_GAMES

  const allStats = useMemo(() => players.map((p) => {
    let s, motm
    if (isLastN) {
      s = recordFromSessions(p.id, filteredSessions)
      motm = motmFromSessions(p.id, filteredSessions)
    } else {
      const year = filterMode === 'all' ? null : filterMode
      const raw = getPlayerStats(p.id, year)
      s = { ...raw, winPct: raw.played > 0 ? Math.round((raw.wins / raw.played) * 100) : null }
      motm = getMotmCount(p.id, year)
    }
    return { ...p, ...s, motm }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [players, filteredSessions, filterMode, isLastN])

  function applySort(rows) {
    return [...rows].sort((a, b) => {
      const aVal = sortCol === 'name' ? a.name : (a[sortCol] ?? -1)
      const bVal = sortCol === 'name' ? b.name : (b[sortCol] ?? -1)
      if (sortCol === 'name') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }

  // Ranked: RANKED_MIN+ games (10 for All Time, 5 for seasons)
  const stats = applySort(allStats.filter((s) => s.played >= RANKED_MIN))

  // Unranked: fewer than RANKED_MIN games (excludes players with 0)
  const unrankedStats = applySort(allStats.filter((s) => s.played > 0 && s.played < RANKED_MIN))

  const sortedByMotm = [...allStats].sort((a, b) => b.motm - a.motm).filter((p) => p.motm > 0)
  const topMotmCount = sortedByMotm[0]?.motm ?? 0
  const topMotmLeaders = topMotmCount > 0 ? sortedByMotm.filter((p) => p.motm === topMotmCount) : []

  // bar chart: only players who've played RANKED_MIN+ games
  const chartData = [...allStats]
    .filter((s) => s.played >= RANKED_MIN)
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))
    .map((s) => ({
      name: s.name.split(' ')[0],   // first name only for axis space
      fullName: s.name,
      winPct: s.winPct ?? 0,
      played: s.played,
    }))

  if (!sessionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0b0f14' }}>
        <p className="text-[#64748b] text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-10 pb-5 relative overflow-hidden grain hero-enter" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1 relative z-10">Performance</p>
        <h1 className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none relative z-10" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Stats
        </h1>
      </header>

      {/* ── Filter selector ── */}
      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {filterOptions.map(({ key, label }) => {
          const active = filterMode === key
          return (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                background: active ? '#16a34a' : '#141920',
                color: active ? '#fff' : '#64748b',
                border: `1px solid ${active ? '#16a34a' : '#252d3a'}`,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="px-4 space-y-4 pb-6 pt-2">
        {players.length === 0 ? (
          <p className="text-[#64748b] text-sm pt-4">No players yet.</p>
        ) : (
          <>
            {/* ── Overview strip ── */}
            <div className="grid grid-cols-2 gap-2 card-enter">
              <OverviewTile label="Games" value={completedSessions.length} />
              <OverviewTile label="Players" value={players.length} />
            </div>

            {/* ── MOTM highlight ── */}
            {topMotmLeaders.length > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'linear-gradient(to right, #2d1f00, #1c1400)', border: '1px solid #a16207' }}
              >
                <span className="text-2xl leading-none shrink-0">⭐</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#a16207] mb-1">Top Man of the Match</p>
                  <div className="flex flex-wrap gap-2">
                    {topMotmLeaders.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-1.5 min-w-0">
                        <PlayerAvatar player={p} size={22} />
                        <span className="font-bold text-[#fbbf24] truncate" style={{ fontFamily: "'Oswald', sans-serif" }}>
                          {p.name}
                        </span>
                        {i < topMotmLeaders.length - 1 && (
                          <span className="text-[#a16207] text-xs">&</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[#a16207] text-xs mt-0.5">
                    {topMotmCount} award{topMotmCount !== 1 ? 's' : ''}{topMotmLeaders.length > 1 ? ' (tied)' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* ── Leaderboard table ── */}
            <Section title="Leaderboard" subtitle={`Ranked: ${RANKED_MIN}+ games played`}>
              <div
                className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ gridTemplateColumns: '1fr 34px 34px 34px 34px 52px', borderBottom: '1px solid #252d3a' }}
              >
                <SortHeader label="Player" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" />
                <SortHeader label="P" col="played" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="W" col="wins" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="D" col="draws" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="L" col="losses" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Win%" col="winPct" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </div>
              {stats.map((s, i) => (
                <LeaderboardRow key={s.id} s={s} rank={i + 1} isLast={i === stats.length - 1 && unrankedStats.length === 0} firePlayerIds={firePlayerIds} frostPlayerIds={frostPlayerIds} />
              ))}
              {unrankedStats.length > 0 && (
                <>
                  <div
                    className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#334155]"
                    style={{ borderTop: '1px solid #252d3a', background: '#0f1520' }}
                  >
                    Fewer than {RANKED_MIN} games
                  </div>
                  {unrankedStats.map((s, i) => (
                    <LeaderboardRow key={s.id} s={s} rank={null} isLast={i === unrankedStats.length - 1} dimmed firePlayerIds={firePlayerIds} frostPlayerIds={frostPlayerIds} />
                  ))}
                </>
              )}
            </Section>

            {/* ── Win % bar chart ── */}
            {chartData.length > 0 && (
              <Section
                title="Win Rate"
                subtitle={`Players with ${RANKED_MIN}+ games (${chartData.length})`}
              >
                <div className="px-2 pt-2 pb-3">
                  <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 24)}>
                    <BarChart
                      layout="vertical"
                      data={chartData}
                      margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
                      barCategoryGap="20%"
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fill: '#334155', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: "'Oswald', sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                      />
                      <ReferenceLine
                        x={50}
                        stroke="#252d3a"
                        strokeDasharray="4 3"
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                      <Bar dataKey="winPct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.fullName}
                            fill={winColor(entry.winPct)}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* ── MOTM leaderboard ── */}
            <MotmLeaderboard stats={allStats} />

            {/* ── Head to Head ── */}
            <HeadToHead players={players} sessions={sessions} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sort header ────────────────────────────────────────────────
function SortHeader({ label, col, sortCol, sortDir, onSort, align = 'center' }) {
  const active = sortCol === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${align === 'left' ? '' : 'justify-center'}`}
      style={{ color: active ? '#16a34a' : '#64748b' }}
    >
      {label}
      <span className="text-[8px] leading-none" style={{ opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
      </span>
    </button>
  )
}

// ─── Leaderboard row ────────────────────────────────────────────
function LeaderboardRow({ s, rank, isLast, dimmed = false, firePlayerIds = new Set(), frostPlayerIds = new Set() }) {
  return (
    <Link
      to={`/player/${s.id}`}
      className="grid px-4 py-3 items-center hover:bg-[#1c2330] transition-colors"
      style={{
        gridTemplateColumns: '1fr 34px 34px 34px 34px 52px',
        borderBottom: isLast ? 'none' : '1px solid #252d3a',
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] font-bold w-4 shrink-0" style={{ color: rank === 1 ? '#f59e0b' : '#334155' }}>
          {rank ?? '—'}
        </span>
        <PlayerAvatar player={s} size={20} />
        <span className="text-sm font-medium text-[#f1f5f9] truncate">{s.name}</span>
        {firePlayerIds.has(s.id) && <FireIcon size={12} />}
        {frostPlayerIds.has(s.id) && <FrostIcon size={12} />}
        {s.motm > 0 && <span className="text-xs shrink-0" title={`${s.motm}× MOTM`}>⭐</span>}
      </div>
      <span className="text-center text-sm text-[#94a3b8]">{s.played}</span>
      <span className="text-center text-sm font-semibold" style={{ color: '#22c55e' }}>{s.wins}</span>
      <span className="text-center text-sm text-[#94a3b8]">{s.draws}</span>
      <span className="text-center text-sm" style={{ color: '#f87171' }}>{s.losses}</span>
      <div className="flex justify-center">
        {s.winPct !== null ? (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: winBg(s.winPct), color: winColor(s.winPct) }}
          >
            {s.winPct}%
          </span>
        ) : (
          <span className="text-xs text-[#334155]">—</span>
        )}
      </div>
    </Link>
  )
}

// ─── Chart tooltip ──────────────────────────────────────────────
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{ background: '#1c2330', border: '1px solid #252d3a', minWidth: 110 }}
    >
      <p className="font-bold text-[#f1f5f9] mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>{d.fullName}</p>
      <p style={{ color: winColor(d.winPct) }}>
        Win rate: <strong>{d.winPct}%</strong>
      </p>
      <p className="text-[#64748b]">Games played: {d.played}</p>
    </div>
  )
}

// ─── MOTM leaderboard ───────────────────────────────────────────
function MotmLeaderboard({ stats }) {
  const ranked = [...stats].sort((a, b) => b.motm - a.motm).filter((s) => s.motm > 0)
  if (ranked.length === 0) return null

  return (
    <Section title="Man of the Match" titleColor="#a16207" icon="⭐">
      <div className="px-4 py-3 space-y-3">
        {ranked.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="text-xs font-bold w-5 shrink-0 text-center" style={{ color: i === 0 ? '#eab308' : '#334155' }}>
              {i === 0 ? '⭐' : i + 1}
            </span>
            <PlayerAvatar player={s} size={24} />
            <span className="text-sm text-[#f1f5f9] flex-1 truncate">{s.name}</span>
            <div className="flex items-center gap-2 w-28">
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1c2330', height: 5 }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((s.motm / ranked[0].motm) * 100)}%`,
                    background: i === 0 ? '#eab308' : '#334155',
                    boxShadow: i === 0 ? '0 0 8px #eab30866' : 'none',
                  }}
                />
              </div>
              <span
                className="text-sm font-bold w-4 text-right shrink-0"
                style={{ fontFamily: "'Oswald', sans-serif", color: i === 0 ? '#fbbf24' : '#64748b' }}
              >
                {s.motm}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── shared sub-components ──────────────────────────────────────
function Section({ title, subtitle, titleColor = '#64748b', icon, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
        {icon && <span className="text-base leading-none">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h2
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: "'Oswald', sans-serif", color: titleColor }}
          >
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-[#334155] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function OverviewTile({ label, value }) {
  return (
    <div className="rounded-xl p-3 text-center card-hover" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      <p className="score-num text-[#f1f5f9]" style={{ fontSize: 40 }}>
        {value}
      </p>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

// ─── Head to Head ────────────────────────────────────────────────
function RecordPills({ wins, draws, losses, label, accentColor }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#14532d', color: '#22c55e' }}>{wins}W</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#1c2330', color: '#64748b' }}>{draws}D</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2d1515', color: '#f87171' }}>{losses}L</span>
        <span className="text-xs text-[#334155]">{wins + draws + losses}g</span>
      </div>
    </div>
  )
}

function HeadToHead({ players, sessions }) {
  const [pA, setPA] = useState('')
  const [pB, setPB] = useState('')

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name))
  const playerA = players.find((p) => p.id === pA)
  const playerB = players.find((p) => p.id === pB)

  const h2h = pA && pB && pA !== pB ? computeH2H(pA, pB, sessions) : null

  const selectStyle = {
    background: '#1c2330',
    border: '1px solid #252d3a',
    color: '#f1f5f9',
    borderRadius: 12,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  return (
    <Section title="Head to Head" icon="⚔️">
      <div className="p-4 space-y-4">
        {/* Player selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#475569] font-semibold mb-1">Player A</p>
            <select value={pA} onChange={(e) => setPA(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {sortedPlayers.filter((p) => p.id !== pB).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#475569] font-semibold mb-1">Player B</p>
            <select value={pB} onChange={(e) => setPB(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {sortedPlayers.filter((p) => p.id !== pA).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        {h2h && playerA && playerB ? (
          h2h.total === 0 ? (
            <p className="text-xs text-[#475569] text-center py-2">
              {playerA.name} and {playerB.name} have never played together.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: '#0f1621', border: '1px solid #252d3a' }}>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  <span className="font-bold text-[#f1f5f9]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {playerA.name}
                  </span>
                  {' and '}
                  <span className="font-bold text-[#f1f5f9]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {playerB.name}
                  </span>
                  {` have played `}
                  <span className="font-bold text-[#f1f5f9]">{h2h.total}</span>
                  {` games together.`}
                </p>
              </div>

              {/* Same team record */}
              {h2h.same.played > 0 && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: '#0d2010', border: '1px solid #16a34a33' }}>
                  <RecordPills
                    label="Same team"
                    wins={h2h.same.wins}
                    draws={h2h.same.draws}
                    losses={h2h.same.losses}
                  />
                </div>
              )}

              {/* Opposing teams record */}
              {h2h.opp.played > 0 && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: '#0d1520', border: '1px solid #3b82f633' }}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#475569' }}>
                    Opposing teams
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#f1f5f9]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                        {playerA.name}
                      </span>
                      <div className="flex gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#14532d', color: '#22c55e' }}>{h2h.opp.winsA}W</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#1c2330', color: '#64748b' }}>{h2h.opp.draws}D</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2d1515', color: '#f87171' }}>{h2h.opp.lossesA}L</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#f1f5f9]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                        {playerB.name}
                      </span>
                      <div className="flex gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#14532d', color: '#22c55e' }}>{h2h.opp.lossesA}W</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#1c2330', color: '#64748b' }}>{h2h.opp.draws}D</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2d1515', color: '#f87171' }}>{h2h.opp.winsA}L</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#334155] mt-0.5">{h2h.opp.played} game{h2h.opp.played !== 1 ? 's' : ''} against each other</p>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-[#334155] text-center py-2">Select two players to compare</p>
        )}
      </div>
    </Section>
  )
}
