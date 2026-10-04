import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../context/app-context'
import { MIN_RATED_GAMES, REGULAR_THRESHOLD, winColor } from '../lib/constants'
import { currentYear, firstName, pct, plural } from '../lib/format'
import { computeH2H, motmFromSessions, recordFromSessions } from '../lib/stats'
import { Loading, PageHeader, Pills, RecordChips, Section, StatTile, WinPill } from '../components/ui'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'

const TABLE_COLS = 'minmax(0,1fr) 30px 30px 30px 30px 56px'
const LAST_N = { last10: 10, last20: 20 }

export default function Stats() {
  const { players, sessions, playedSessions, sessionsLoaded, getPlayerStats, getMotmCount, firePlayerIds, frostPlayerIds } = useApp()
  const [filter, setFilter] = useState('all') // 'all' | year | 'last10' | 'last20'
  const [sort, setSort] = useState({ col: 'winPct', dir: 'desc' })

  const lastN = LAST_N[filter] ?? null
  const completed = useMemo(() => playedSessions.filter((s) => s.result), [playedSessions]) // newest first

  const filterOptions = useMemo(() => {
    const years = new Set(sessions.map((s) => s.date?.slice(0, 4)).filter(Boolean))
    years.add('2025') // 2025 exists through legacy stats even without sessions
    years.add(currentYear())
    return [
      { value: 'all', label: 'All time' },
      ...[...years].sort((a, b) => b.localeCompare(a)).map((y) => ({ value: y, label: `${y} season` })),
      { value: 'last10', label: 'Last 10' },
      { value: 'last20', label: 'Last 20' },
    ]
  }, [sessions])

  // Completed games inside the current filter
  const games = useMemo(() => {
    if (filter === 'all') return completed
    if (lastN) return completed.slice(0, lastN)
    return completed.filter((s) => s.date?.startsWith(filter))
  }, [completed, filter, lastN])

  // "Last N" is computed purely from sessions; seasons and all-time include legacy numbers
  const rows = useMemo(() => players.map((p) => {
    if (lastN) return { ...p, ...recordFromSessions(p.id, games), motm: motmFromSessions(p.id, games) }
    const year = filter === 'all' ? null : filter
    const record = getPlayerStats(p.id, year)
    return { ...p, ...record, winPct: pct(record.wins, record.played), motm: getMotmCount(p.id, year) }
  }), [players, games, filter, lastN, getPlayerStats, getMotmCount])

  if (!sessionsLoaded) return <Loading />

  const rankedMin = filter === 'all' ? REGULAR_THRESHOLD : MIN_RATED_GAMES
  const bySort = (a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.col === 'name') return a.name.localeCompare(b.name) * dir
    return ((a[sort.col] ?? -1) - (b[sort.col] ?? -1)) * dir || b.played - a.played
  }
  const ranked = rows.filter((r) => r.played >= rankedMin).sort(bySort)
  const unranked = rows.filter((r) => r.played > 0 && r.played < rankedMin).sort(bySort)
  const motmRows = rows.filter((r) => r.motm > 0).sort((a, b) => b.motm - a.motm)
  const topMotm = motmRows.filter((r) => r.motm === motmRows[0].motm)
  const chartData = rows
    .filter((r) => r.played >= rankedMin)
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))
    .map((r) => ({ name: firstName(r.name), fullName: r.name, winPct: r.winPct ?? 0, played: r.played }))

  const onSort = (col) =>
    setSort((prev) => (prev.col === col ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: col === 'name' ? 'asc' : 'desc' }))
  const rowMarks = (id) => ({ fire: firePlayerIds.has(id), frost: frostPlayerIds.has(id) })

  return (
    <div className="flex flex-col">
      <PageHeader kicker="Performance" title="Stats" />

      <div className="space-y-4 px-4">
        <Pills options={filterOptions} value={filter} onChange={setFilter} />

        {players.length === 0 ? (
          <p className="pt-4 text-sm text-muted">No players yet.</p>
        ) : (
          <div className="stagger space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile value={games.length} label="Games" color="#22c55e" />
              <StatTile value={rows.filter((r) => r.played > 0).length} label="Players" />
            </div>

            {topMotm.length > 0 && (
              <section
                className="card flex items-center gap-3 px-4 py-3.5"
                style={{ background: 'linear-gradient(90deg, #2d1f00, #1a1300)', borderColor: 'rgba(161,98,7,0.7)' }}
              >
                <div className="flex shrink-0 -space-x-2">
                  {topMotm.slice(0, 3).map((p) => <PlayerAvatar key={p.id} player={p} size={40} ring="#fbbf24" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-mid">Most Man of the Match</p>
                  <p className="display truncate text-xl leading-tight text-gold">{topMotm.map((p) => p.name).join(' & ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-4xl text-gold">{topMotm[0].motm}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-gold-mid">{topMotm.length > 1 ? 'each' : topMotm[0].motm === 1 ? 'award' : 'awards'}</p>
                </div>
              </section>
            )}

            {/* ── Leaderboard ── */}
            <Section title="Leaderboard" subtitle={`Ranked from ${rankedMin} games · tap a column to sort`}>
              <div className="grid items-center border-b border-line px-3 py-2" style={{ gridTemplateColumns: TABLE_COLS }}>
                <SortHeader label="Player" col="name" sort={sort} onSort={onSort} left />
                <SortHeader label="P" col="played" sort={sort} onSort={onSort} />
                <SortHeader label="W" col="wins" sort={sort} onSort={onSort} />
                <SortHeader label="D" col="draws" sort={sort} onSort={onSort} />
                <SortHeader label="L" col="losses" sort={sort} onSort={onSort} />
                <SortHeader label="Win%" col="winPct" sort={sort} onSort={onSort} />
              </div>
              {ranked.length === 0 && unranked.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted">No games in this period yet.</p>
              )}
              {ranked.map((r, i) => <LeaderboardRow key={r.id} row={r} rank={i + 1} {...rowMarks(r.id)} />)}
              {unranked.length > 0 && (
                <>
                  <p className="border-y border-line bg-pitch/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Fewer than {plural(rankedMin, 'game')}
                  </p>
                  {unranked.map((r) => <LeaderboardRow key={r.id} row={r} rank={null} {...rowMarks(r.id)} />)}
                </>
              )}
            </Section>

            {/* ── Win rate chart ── */}
            {chartData.length > 0 && (
              <Section title="Win rate" subtitle={`${plural(chartData.length, 'player')} with ${rankedMin}+ games`}>
                <div className="px-1 pb-3 pt-2">
                  <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 26)}>
                    <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 40, bottom: 4, left: 4 }} barCategoryGap="22%">
                      <XAxis
                        type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                        tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category" dataKey="name" width={62} axisLine={false} tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Oswald, sans-serif' }}
                      />
                      <ReferenceLine x={50} stroke="#334155" strokeDasharray="4 3" />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                      <Bar dataKey="winPct" radius={[0, 5, 5, 0]} maxBarSize={16}>
                        {chartData.map((d) => <Cell key={d.fullName} fill={winColor(d.winPct)} fillOpacity={0.9} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* ── MOTM table ── */}
            {motmRows.length > 0 && (
              <Section title="Man of the Match" icon="⭐" tone="gold">
                <ol className="space-y-3 px-4 py-4">
                  {motmRows.map((r, i) => {
                    const lead = r.motm === motmRows[0].motm
                    return (
                      <li key={r.id}>
                        <Link to={`/player/${r.id}`} className="flex items-center gap-3">
                          <span className="num w-5 shrink-0 pt-0.5 text-center text-lg" style={{ color: lead ? '#fbbf24' : '#475569' }}>{i + 1}</span>
                          <PlayerAvatar player={r} size={26} ring={lead ? '#fbbf24' : null} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.name}</span>
                          <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-raised">
                            <span className="bar-grow block h-full rounded-full" style={{ width: `${(r.motm / motmRows[0].motm) * 100}%`, background: lead ? '#fbbf24' : '#475569' }} />
                          </span>
                          <span className="num w-6 shrink-0 pt-0.5 text-right text-xl" style={{ color: lead ? '#fbbf24' : '#94a3b8' }}>{r.motm}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </Section>
            )}

            <HeadToHead players={players} sessions={completed} />
          </div>
        )}
      </div>
    </div>
  )
}

function SortHeader({ label, col, sort, onSort, left = false }) {
  const active = sort.col === col
  return (
    <button
      type="button" onClick={() => onSort(col)}
      aria-label={`Sort by ${label}`}
      className={`flex min-h-8 items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider ${left ? 'pl-1' : 'justify-center'} ${active ? 'text-green-bright' : 'text-muted'}`}
    >
      {label}
      <span className="text-[8px]" style={{ opacity: active ? 1 : 0 }}>{sort.dir === 'desc' ? '▼' : '▲'}</span>
    </button>
  )
}

function LeaderboardRow({ row, rank, fire, frost }) {
  return (
    <Link
      to={`/player/${row.id}`}
      className={`grid items-center border-b border-line/60 px-3 py-2.5 last:border-b-0 active:bg-raised ${rank ? '' : 'opacity-60'}`}
      style={{ gridTemplateColumns: TABLE_COLS }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="num w-4 shrink-0 pt-0.5 text-center text-base" style={{ color: rank === 1 ? '#fbbf24' : '#475569' }}>{rank ?? '–'}</span>
        <PlayerAvatar player={row} size={24} />
        <span className="truncate text-sm font-medium text-ink">{row.name}</span>
        {fire && <FireIcon size={12} />}
        {frost && <FrostIcon size={12} />}
      </div>
      <span className="text-center text-sm tabular-nums text-mist">{row.played}</span>
      <span className="text-center text-sm font-semibold tabular-nums text-green-bright">{row.wins}</span>
      <span className="text-center text-sm tabular-nums text-mist">{row.draws}</span>
      <span className="text-center text-sm tabular-nums text-red-bright">{row.losses}</span>
      <span className="text-center"><WinPill pct={row.winPct} /></span>
    </Link>
  )
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-xs shadow-xl">
      <p className="display mb-1 text-sm text-ink">{d.fullName}</p>
      <p style={{ color: winColor(d.winPct) }}>Win rate <strong>{d.winPct}%</strong></p>
      <p className="text-muted">{plural(d.played, 'game')}</p>
    </div>
  )
}

// ─── Head to head ───────────────────────────────────────────────
function HeadToHead({ players, sessions }) {
  const [pA, setPA] = useState('')
  const [pB, setPB] = useState('')
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name))
  const playerA = players.find((p) => p.id === pA)
  const playerB = players.find((p) => p.id === pB)
  const h2h = playerA && playerB ? computeH2H(pA, pB, sessions) : null

  const picker = (label, value, onChange, exclude) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
        <option value="">Select…</option>
        {sorted.filter((p) => p.id !== exclude).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )

  return (
    <Section title="Head to head" icon="⚔️">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          {picker('Player one', pA, setPA, pB)}
          {picker('Player two', pB, setPB, pA)}
        </div>

        {!h2h ? (
          <p className="py-2 text-center text-sm text-muted">Pick two players to compare.</p>
        ) : h2h.total === 0 ? (
          <p className="py-2 text-center text-sm text-muted">{playerA.name} and {playerB.name} haven’t played in the same game.</p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-center gap-3 py-1">
              <PlayerAvatar player={playerA} size={44} ring="#22c55e" />
              <div className="text-center">
                <p className="num text-4xl text-ink">{h2h.total}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted">games together</p>
              </div>
              <PlayerAvatar player={playerB} size={44} ring="#60a5fa" />
            </div>

            {h2h.same.played > 0 && (
              <div className="inset flex items-center justify-between gap-3 px-3.5 py-3">
                <div>
                  <p className="eyebrow">Same team</p>
                  <p className="mt-0.5 text-xs text-muted">{plural(h2h.same.played, 'game')}</p>
                </div>
                <RecordChips wins={h2h.same.wins} draws={h2h.same.draws} losses={h2h.same.losses} />
              </div>
            )}

            {h2h.opp.played > 0 && (
              <div className="inset space-y-2.5 px-3.5 py-3">
                <div>
                  <p className="eyebrow">Against each other</p>
                  <p className="mt-0.5 text-xs text-muted">{plural(h2h.opp.played, 'game')}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="display truncate text-sm text-ink">{playerA.name}</span>
                  <RecordChips wins={h2h.opp.winsA} draws={h2h.opp.draws} losses={h2h.opp.lossesA} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="display truncate text-sm text-ink">{playerB.name}</span>
                  <RecordChips wins={h2h.opp.lossesA} draws={h2h.opp.draws} losses={h2h.opp.winsA} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
