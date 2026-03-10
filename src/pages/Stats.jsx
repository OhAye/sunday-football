import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useApp } from '../context/AppContext'

// ─── colour helpers ─────────────────────────────────────────────
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
  const { players, sessions, getPlayerStats, getMotmCount } = useApp()

  const completedSessions = sessions.filter((s) => s.result)
  const totalGoals = completedSessions.reduce((sum, s) => {
    if (!s.result?.goals) return sum
    return sum + Object.values(s.result.goals).reduce((a, b) => a + b, 0)
  }, 0)

  const stats = [...players]
    .map((p) => {
      const s = getPlayerStats(p.id)
      const winPct = s.played > 0 ? Math.round((s.wins / s.played) * 100) : null
      return { ...p, ...s, winPct, motm: getMotmCount(p.id) }
    })
    // leaderboard: sort by win% desc (played > 0 first), then by games played
    .sort((a, b) => {
      if (a.played === 0 && b.played === 0) return a.name.localeCompare(b.name)
      if (a.played === 0) return 1
      if (b.played === 0) return -1
      return (b.winPct ?? 0) - (a.winPct ?? 0) || b.played - a.played
    })

  const topMotm = [...stats].sort((a, b) => b.motm - a.motm)[0]

  // bar chart: only players who've played 3+ games
  const chartData = [...stats]
    .filter((s) => s.played >= 3)
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))
    .map((s) => ({
      name: s.name.split(' ')[0],   // first name only for axis space
      fullName: s.name,
      winPct: s.winPct ?? 0,
      played: s.played,
    }))

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-10 pb-5" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Performance</p>
        <h1 className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Stats
        </h1>
      </header>

      <div className="px-4 space-y-4 pb-6">
        {players.length === 0 ? (
          <p className="text-[#64748b] text-sm pt-4">No players yet.</p>
        ) : (
          <>
            {/* ── Overview strip ── */}
            <div className="grid grid-cols-3 gap-2">
              <OverviewTile label="Games" value={completedSessions.length} />
              <OverviewTile label="Players" value={players.length} />
              <OverviewTile label="Goals" value={totalGoals} />
            </div>

            {/* ── MOTM highlight ── */}
            {topMotm?.motm > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'linear-gradient(to right, #2d1f00, #1c1400)', border: '1px solid #a16207' }}
              >
                <span className="text-2xl leading-none">⭐</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#a16207]">Top Man of the Match</p>
                  <p className="font-bold text-[#fbbf24]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {topMotm.name}
                    <span className="text-[#a16207] font-normal text-sm ml-2">{topMotm.motm} award{topMotm.motm !== 1 ? 's' : ''}</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── Leaderboard table ── */}
            <Section title="Leaderboard">
              <div
                className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]"
                style={{ gridTemplateColumns: '1fr 34px 34px 34px 34px 52px', borderBottom: '1px solid #252d3a' }}
              >
                <span>Player</span>
                <span className="text-center">P</span>
                <span className="text-center">W</span>
                <span className="text-center">D</span>
                <span className="text-center">L</span>
                <span className="text-center">Win%</span>
              </div>
              {stats.map((s, i) => (
                <div
                  key={s.id}
                  className="grid px-4 py-3 items-center"
                  style={{
                    gridTemplateColumns: '1fr 34px 34px 34px 34px 52px',
                    borderBottom: i < stats.length - 1 ? '1px solid #252d3a' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold w-4 shrink-0" style={{ color: i === 0 && s.played > 0 ? '#f59e0b' : '#334155' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-[#f1f5f9] truncate">{s.name}</span>
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
                </div>
              ))}
            </Section>

            {/* ── Win % bar chart ── */}
            {chartData.length > 0 && (
              <Section
                title="Win Rate"
                subtitle={`Players with 3+ games (${chartData.length})`}
              >
                <div className="px-2 pt-2 pb-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, bottom: 24, left: -16 }}
                      barCategoryGap="28%"
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: "'Oswald', sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={chartData.length > 6 ? -35 : 0}
                        textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                        height={chartData.length > 6 ? 40 : 20}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fill: '#334155', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <ReferenceLine
                        y={50}
                        stroke="#252d3a"
                        strokeDasharray="4 3"
                        label={{ value: '50%', fill: '#334155', fontSize: 9, position: 'insideTopRight' }}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                      <Bar dataKey="winPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
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
            <MotmLeaderboard stats={stats} />
          </>
        )}
      </div>
    </div>
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
    <div className="rounded-xl p-3 text-center" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      <p className="text-3xl font-bold text-[#f1f5f9] leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {value}
      </p>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
