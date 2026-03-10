import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

// ─── date helpers ──────────────────────────────────────────────
function getNextSunday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()                     // 0 = Sun
  const daysUntil = dow === 0 ? 0 : 7 - dow
  const next = new Date(today)
  next.setDate(today.getDate() + daysUntil)
  return { date: next, daysUntil }
}

function toYMD(d) {
  return d.toISOString().slice(0, 10)
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ─── page ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { players, sessions, getPlayerStats, getMotmCount } = useApp()

  /* ── countdown ── */
  const { date: nextSunday, daysUntil } = getNextSunday()
  const nextSundayStr = toYMD(nextSunday)
  const scheduledSession = sessions.find((s) => s.date === nextSundayStr)
  const isMatchday = daysUntil === 0

  /* ── last result ── */
  const lastResult = [...sessions]
    .filter((s) => s.result)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null

  /* ── season numbers ── */
  const completedSessions = sessions.filter((s) => s.result)
  const totalGoals = completedSessions.reduce((sum, s) => {
    if (!s.result?.goals) return sum
    return sum + Object.values(s.result.goals).reduce((a, b) => a + b, 0)
  }, 0)

  /* ── player stats ── */
  const allStats = players.map((p) => ({
    ...p,
    ...getPlayerStats(p.id),
    motm: getMotmCount(p.id),
  }))

  const motmLeader = [...allStats].sort((a, b) => b.motm - a.motm).find((p) => p.motm > 0) ?? null
  const winLeader  = [...allStats]
    .filter((p) => p.played >= 5)
    .sort((a, b) => b.wins / b.played - a.wins / a.played)[0] ?? null

  /* ── recent form (last 5 completed) ── */
  const recentForm = completedSessions
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((s) => {
      const { scoreA, scoreB } = s.result
      if (scoreA > scoreB) return 'A'    // Team A won
      if (scoreB > scoreA) return 'B'    // Team B won
      return 'D'
    })

  const playerName = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'

  return (
    <div className="flex flex-col">
      {/* ── Hero header ── */}
      <header
        className="px-5 pt-10 pb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1f11 0%, #0b0f14 60%)' }}
      >
        {/* decorative pitch lines */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #16a34a 0px, #16a34a 1px, transparent 1px, transparent 40px)',
        }} />
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.3em] uppercase mb-2 relative">
          Sunday 7-a-side
        </p>
        <h1
          className="text-5xl font-bold uppercase leading-none text-[#f1f5f9] relative"
          style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: '-0.01em' }}
        >
          Sunday
          <br />
          <span style={{ color: '#16a34a', textShadow: '0 0 30px #16a34a55' }}>FC</span>
        </h1>
        <div className="mt-4 h-0.5 w-16 rounded-full relative" style={{ background: '#16a34a', boxShadow: '0 0 12px #16a34a' }} />
      </header>

      <div className="px-4 space-y-4 pb-6">

        {/* ── Countdown card ── */}
        <CountdownCard
          isMatchday={isMatchday}
          daysUntil={daysUntil}
          nextSundayStr={nextSundayStr}
          scheduledSession={scheduledSession}
        />

        {/* ── Last result ── */}
        {lastResult ? (
          <LastResultCard session={lastResult} players={players} playerName={playerName} />
        ) : (
          <EmptyCard
            label="No Results Yet"
            sub="Record your first match to see results here"
            action={{ to: '/lineups', label: 'Add Match →' }}
          />
        )}

        {/* ── Season numbers ── */}
        <div className="grid grid-cols-3 gap-2">
          <SeasonTile value={completedSessions.length} label="Matches" color="#16a34a" />
          <SeasonTile value={totalGoals} label="Goals" color="#3b82f6" />
          <SeasonTile value={players.length} label="Players" color="#a855f7" />
        </div>

        {/* ── Leaders ── */}
        <div className="grid grid-cols-2 gap-3">
          <LeaderCard
            title="MOTM Leader"
            icon="⭐"
            accentColor="#eab308"
            dimColor="#3d2c00"
            player={motmLeader}
            stat={motmLeader ? `${motmLeader.motm} award${motmLeader.motm !== 1 ? 's' : ''}` : null}
            emptyText="No awards yet"
          />
          <LeaderCard
            title="Win Rate"
            icon="🏆"
            accentColor="#a855f7"
            dimColor="#2e1065"
            player={winLeader}
            stat={winLeader
              ? `${Math.round((winLeader.wins / winLeader.played) * 100)}% · ${winLeader.played}g`
              : null}
            emptyText="Need 5+ games"
          />
        </div>

        {/* ── Recent form ── */}
        {recentForm.length > 0 && (
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: '#141920', border: '1px solid #252d3a' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                Recent Form
              </p>
              <Link to="/lineups" className="text-[10px] text-[#16a34a] font-semibold hover:text-[#22c55e]">
                All matches →
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {recentForm.map((r, i) => (
                <FormDot key={i} result={r} />
              ))}
              {recentForm.length < 5 && (
                <p className="text-[10px] text-[#334155] ml-1">
                  {5 - recentForm.length} more to go
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Countdown card ────────────────────────────────────────────
function CountdownCard({ isMatchday, daysUntil, nextSundayStr, scheduledSession }) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: isMatchday
          ? 'linear-gradient(135deg, #0d2a13, #0a1f0e)'
          : 'linear-gradient(135deg, #0f1a12, #141920)',
        border: `1px solid ${isMatchday ? '#16a34a' : '#252d3a'}`,
        boxShadow: isMatchday ? '0 0 30px #16a34a22' : 'none',
      }}
    >
      {/* pitch-stripe decoration */}
      <div
        className="absolute top-0 right-0 w-32 h-full opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #16a34a, #16a34a 1px, transparent 1px, transparent 16px)',
        }}
      />

      <div className="px-5 py-4 relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#64748b] mb-1">
          {isMatchday ? '🟢 Today' : 'Next Matchday'}
        </p>

        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-base font-bold text-[#f1f5f9] uppercase leading-tight"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              {fmtDay(nextSundayStr)}
            </p>
            {scheduledSession ? (
              <p className="text-xs text-[#64748b] mt-1">
                {scheduledSession.playerIds.length} players confirmed
              </p>
            ) : (
              <Link to="/lineups" className="text-xs text-[#334155] hover:text-[#16a34a] transition-colors mt-1 block">
                No session scheduled →
              </Link>
            )}
          </div>

          {isMatchday ? (
            <div className="text-right">
              <p
                className="text-3xl font-bold uppercase leading-none"
                style={{ fontFamily: "'Oswald', sans-serif", color: '#16a34a', textShadow: '0 0 20px #16a34a66' }}
              >
                Matchday!
              </p>
              <div className="flex justify-end gap-1 mt-1">
                <span
                  className="w-2 h-2 rounded-full inline-block animate-pulse"
                  style={{ background: '#16a34a', boxShadow: '0 0 6px #16a34a' }}
                />
              </div>
            </div>
          ) : (
            <div className="text-right">
              <p
                className="leading-none font-bold"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: daysUntil <= 2 ? 56 : 48,
                  color: daysUntil <= 2 ? '#22c55e' : '#f1f5f9',
                  textShadow: daysUntil <= 2 ? '0 0 24px #16a34a55' : 'none',
                }}
              >
                {daysUntil}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[#64748b]">
                {daysUntil === 1 ? 'day to go' : 'days to go'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Last result card ──────────────────────────────────────────
function LastResultCard({ session, players, playerName }) {
  const { scoreA, scoreB } = session.result
  const aWon = scoreA > scoreB
  const bWon = scoreB > scoreA
  const isDraw = scoreA === scoreB
  const motmPlayer = session.motm ? players.find((p) => p.id === session.motm) : null

  const teamA = session.teams?.teamA ?? []
  const teamB = session.teams?.teamB ?? []

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      {/* card header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]"
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            Last Result
          </p>
          <p className="text-xs text-[#334155] mt-0.5">{fmtShort(session.date)}</p>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{
            background: isDraw ? '#3d2c0044' : aWon ? '#14532d' : '#1e3a5f',
            color: isDraw ? '#f59e0b' : aWon ? '#22c55e' : '#60a5fa',
            border: `1px solid ${isDraw ? '#f59e0b44' : aWon ? '#16a34a55' : '#3b82f655'}`,
          }}
        >
          {isDraw ? 'Draw' : aWon ? 'Team A Win' : 'Team B Win'}
        </span>
      </div>

      {/* scoreline */}
      <div className="flex items-center px-4 py-5 gap-2">
        {/* Team A */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#16a34a' }}>Team A</p>
          {teamA.slice(0, 5).map((id) => (
            <p key={id} className="text-xs leading-relaxed truncate" style={{ color: session.motm === id ? '#fbbf24' : '#94a3b8' }}>
              {session.motm === id && '⭐ '}
              {playerName(id)}
              {session.result.goals?.[id] > 0 && (
                <span className="text-[#22c55e] ml-1">⚽{session.result.goals[id]}</span>
              )}
            </p>
          ))}
          {teamA.length > 5 && <p className="text-[10px] text-[#334155]">+{teamA.length - 5} more</p>}
        </div>

        {/* Score */}
        <div className="flex flex-col items-center shrink-0 px-2">
          <div className="flex items-baseline gap-1">
            <span
              className="font-bold leading-none"
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: 52,
                color: aWon ? '#22c55e' : isDraw ? '#94a3b8' : '#334155',
                textShadow: aWon ? '0 0 20px #16a34a44' : 'none',
              }}
            >
              {scoreA}
            </span>
            <span className="text-2xl font-bold text-[#252d3a]" style={{ fontFamily: "'Oswald', sans-serif" }}>–</span>
            <span
              className="font-bold leading-none"
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: 52,
                color: bWon ? '#60a5fa' : isDraw ? '#94a3b8' : '#334155',
                textShadow: bWon ? '0 0 20px #3b82f644' : 'none',
              }}
            >
              {scoreB}
            </span>
          </div>
          <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">
            {session.playerIds.length} players
          </p>
        </div>

        {/* Team B */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#3b82f6' }}>Team B</p>
          {teamB.slice(0, 5).map((id) => (
            <p key={id} className="text-xs leading-relaxed truncate" style={{ color: session.motm === id ? '#fbbf24' : '#94a3b8' }}>
              {session.result.goals?.[id] > 0 && (
                <span className="text-[#60a5fa] mr-1">⚽{session.result.goals[id]}</span>
              )}
              {playerName(id)}
              {session.motm === id && ' ⭐'}
            </p>
          ))}
          {teamB.length > 5 && <p className="text-[10px] text-[#334155]">+{teamB.length - 5} more</p>}
        </div>
      </div>

      {/* MOTM footer */}
      {motmPlayer && (
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid #252d3a', background: 'linear-gradient(to right, #2d1f00, #141920)' }}
        >
          <span className="text-sm">⭐</span>
          <p className="text-xs text-[#a16207]">
            Man of the Match —{' '}
            <span className="font-bold text-[#fbbf24]" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {motmPlayer.name}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Leader card ───────────────────────────────────────────────
function LeaderCard({ title, icon, accentColor, dimColor, player, stat, emptyText }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: player ? `linear-gradient(135deg, ${dimColor}, #141920)` : '#141920',
        border: `1px solid ${player ? accentColor + '44' : '#252d3a'}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm leading-none">{icon}</span>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Oswald', sans-serif", color: player ? accentColor : '#334155' }}
        >
          {title}
        </p>
      </div>
      {player ? (
        <>
          <p
            className="font-bold uppercase leading-tight truncate"
            style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, color: accentColor }}
          >
            {player.name}
          </p>
          <p className="text-xs font-semibold" style={{ color: accentColor + 'cc' }}>{stat}</p>
        </>
      ) : (
        <p className="text-xs text-[#334155] mt-1">{emptyText}</p>
      )}
    </div>
  )
}

// ─── Season tile ───────────────────────────────────────────────
function SeasonTile({ value, label, color }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: '#141920', border: `1px solid ${color}22` }}
    >
      <p
        className="text-3xl font-bold leading-none"
        style={{ fontFamily: "'Oswald', sans-serif", color }}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[#64748b] mt-1">{label}</p>
    </div>
  )
}

// ─── Form dot ──────────────────────────────────────────────────
const FORM = {
  A: { bg: '#14532d', color: '#22c55e', border: '#16a34a', label: 'W (A)' },
  B: { bg: '#1e3a5f', color: '#60a5fa', border: '#3b82f6', label: 'W (B)' },
  D: { bg: '#3d2c00', color: '#fbbf24', border: '#f59e0b', label: 'D' },
}

function FormDot({ result }) {
  const s = FORM[result]
  return (
    <div
      className="flex items-center justify-center rounded-lg font-bold text-xs"
      style={{
        width: 36, height: 36,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}44`,
        fontFamily: "'Oswald', sans-serif",
      }}
      title={s.label}
    >
      {result === 'D' ? 'D' : 'W'}
    </div>
  )
}

// ─── Empty state card ──────────────────────────────────────────
function EmptyCard({ label, sub, action }) {
  return (
    <div
      className="rounded-2xl px-5 py-6 text-center"
      style={{ background: '#141920', border: '1px solid #252d3a' }}
    >
      <p className="text-sm font-semibold text-[#64748b]">{label}</p>
      <p className="text-xs text-[#334155] mt-1">{sub}</p>
      {action && (
        <Link
          to={action.to}
          className="inline-block mt-3 text-sm font-bold text-[#16a34a] hover:text-[#22c55e] transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
