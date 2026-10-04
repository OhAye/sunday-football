import { useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'

// How many players to show in each ranked board
const TOP_N = 5

// Assign competition-style ranks (1, 2, 2, 4 …) to an already-sorted list.
// `valueOf` decides ties, `labelOf` builds the stat shown on the right.
function rankRows(list, valueOf, labelOf) {
  let prevVal = null
  let prevRank = 0
  return list.map((p, i) => {
    const v = valueOf(p)
    const rank = prevVal !== null && v === prevVal ? prevRank : i + 1
    prevVal = v
    prevRank = rank
    return { player: p, rank, label: labelOf(p) }
  })
}

// ─── date helpers ──────────────────────────────────────────────

// Ramadan break — skip to this date instead of the immediate next Sunday
const BREAK_UNTIL = '2026-03-22'

function getNextSunday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // If we're in a break period, jump to the return date
  const breakUntil = new Date(BREAK_UNTIL + 'T00:00:00')
  if (today < breakUntil) {
    const daysUntil = Math.round((breakUntil - today) / 86400000)
    return { date: breakUntil, daysUntil, isOnBreak: true }
  }

  const dow = today.getDay()                     // 0 = Sun
  const daysUntil = dow === 0 ? 0 : 7 - dow
  const next = new Date(today)
  next.setDate(today.getDate() + daysUntil)
  return { date: next, daysUntil, isOnBreak: false }
}

function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  const { players, sessions, sessionsLoaded, getPlayerStats, getMotmCount, getStreaks, getAttendance } = useApp()
  const navigate = useNavigate()
  const tapCount = useRef(0)
  const tapTimer = useRef(null)
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  function handleTitleTap() {
    tapCount.current += 1
    clearTimeout(tapTimer.current)
    if (tapCount.current >= 7) {
      tapCount.current = 0
      navigate('/admin')
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 3000)
  }

  /* ── countdown ── */
  const { date: nextSunday, daysUntil, isOnBreak } = getNextSunday()
  const nextSundayStr = toYMD(nextSunday)
  const scheduledSession = sessions.find((s) => s.date === nextSundayStr)
  const isMatchday = daysUntil === 0

  /* ── last result ── */
  const lastResult = [...sessions]
    .filter((s) => s.result)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null

  /* ── season numbers ── */
  const completedSessions = sessions.filter((s) => s.result)

  /* ── player stats (current season only) ── */
  const currentYear = new Date().getFullYear().toString()
  const allStats = players.map((p) => ({
    ...p,
    ...getPlayerStats(p.id, currentYear),
    motm: getMotmCount(p.id, currentYear),
  }))

  const MIN_STREAK_GAMES = 3

  // ── MOTM (top 5) ──
  const motmRows = rankRows(
    [...allStats].filter((p) => p.motm > 0).sort((a, b) => b.motm - a.motm).slice(0, TOP_N),
    (p) => p.motm,
    (p) => `${p.motm} ⭐`,
  )

  // ── Win rate (top 5, 5+ games) ──
  const winRateRows = rankRows(
    [...allStats]
      .filter((p) => p.played >= 5)
      .map((p) => ({ ...p, pct: Math.round((p.wins / p.played) * 100) }))
      .sort((a, b) => b.pct - a.pct || b.played - a.played)
      .slice(0, TOP_N),
    (p) => p.pct,
    (p) => `${p.pct}% · ${p.played}g`,
  )

  // ── Most Reliable (this season, 3+ appearances) ──
  const reliabilityRanked = players
    .map((p) => ({ ...p, att: getAttendance(p.id, currentYear) }))
    .filter((p) => p.att.played >= MIN_STREAK_GAMES && p.att.rate !== null)
    .sort((a, b) => b.att.rate - a.att.rate || b.att.played - a.att.played)
  const reliableRows = rankRows(
    reliabilityRanked.slice(0, TOP_N),
    (p) => p.att.rate,
    (p) => `${p.att.rate}%`,
  )

  // ── Streaks (current season, 3+ games only) ──
  const playerStreaks = allStats.map((p) => ({ ...p, ...getStreaks(p.id) }))
  const firePlayerIds = new Set(playerStreaks.filter((p) => p.played >= MIN_STREAK_GAMES && p.winStreak >= 3).map((p) => p.id))
  const qualified = playerStreaks.filter((p) => p.played >= MIN_STREAK_GAMES)
  const winStreakRows = rankRows(
    qualified.filter((p) => p.winStreak >= 1).sort((a, b) => b.winStreak - a.winStreak).slice(0, TOP_N),
    (p) => p.winStreak,
    (p) => `${p.winStreak}`,
  )
  const lossStreakRows = rankRows(
    qualified.filter((p) => p.lossStreak >= 1).sort((a, b) => b.lossStreak - a.lossStreak).slice(0, TOP_N),
    (p) => p.lossStreak,
    (p) => `${p.lossStreak}`,
  )

  const playerName = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'

  if (!sessionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0b0f14' }}>
        <p className="text-[#64748b] text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero header ── */}
      <header
        className="px-5 pt-10 pb-6 relative overflow-hidden grain hero-enter"
        style={{ background: 'linear-gradient(160deg, #0d1f11 0%, #0b0f14 60%)' }}
      >
        {/* decorative pitch lines */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #16a34a 0px, #16a34a 1px, transparent 1px, transparent 40px)',
        }} />
        {/* diagonal accent line */}
        <div
          className="absolute -right-8 top-0 w-40 h-full opacity-[0.03] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, #16a34a 50%, transparent 70%)',
          }}
        />
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.3em] uppercase mb-2 relative z-10">
          Sunday 7-a-side
        </p>
        <h1
          onClick={handleTitleTap}
          className="text-5xl font-bold uppercase leading-none text-[#f1f5f9] relative select-none cursor-pointer z-10"
          style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: '-0.01em' }}
        >
          Sunday
          <br />
          <span style={{ color: '#16a34a', textShadow: '0 0 30px #16a34a55' }}>FC</span>
        </h1>
        <div className="mt-4 h-0.5 w-16 rounded-full relative z-10" style={{ background: 'linear-gradient(90deg, #16a34a, #16a34a00)', boxShadow: '0 0 12px #16a34a' }} />
      </header>

      <div className="px-4 space-y-4 pb-6">

        {/* ── Countdown card ── */}
        <div className="card-enter">
          <CountdownCard
            isMatchday={isMatchday}
            isOnBreak={isOnBreak}
            daysUntil={daysUntil}
            nextSundayStr={nextSundayStr}
            scheduledSession={scheduledSession}
          />
        </div>

        {/* ── Last result ── */}
        <div className="card-enter">
          {lastResult ? (
            <LastResultCard session={lastResult} players={players} playerName={playerName} firePlayerIds={firePlayerIds} />
          ) : (
            <EmptyCard
              label="No Results Yet"
              sub="Record your first match to see results here"
              action={{ to: '/lineups', label: 'Add Game' }}
            />
          )}
        </div>

        {/* ── Season numbers ── */}
        <div className="grid grid-cols-2 gap-2 card-enter">
          <SeasonTile value={completedSessions.length} label="Matches" color="#16a34a" />
          <SeasonTile value={players.length} label="Players" color="#a855f7" />
        </div>

        {/* ── Ranked top-5 boards ── */}
        <div className="card-enter">
          <RankedCard
            title="MOTM Leaders"
            icon="⭐"
            accentColor="#eab308"
            dimColor="#3d2c00"
            rows={motmRows}
            firePlayerIds={firePlayerIds}
            emptyText="No awards yet"
          />
        </div>

        <div className="card-enter">
          <RankedCard
            title="Win Rate"
            icon="🏆"
            accentColor="#a855f7"
            dimColor="#2e1065"
            rows={winRateRows}
            firePlayerIds={firePlayerIds}
            emptyText="Need 5+ games"
          />
        </div>

        <div className="card-enter">
          <RankedCard
            title="Win Streak"
            icon={<FireIcon size={14} />}
            accentColor="#f97316"
            dimColor="#431407"
            rows={winStreakRows}
            firePlayerIds={firePlayerIds}
            emptyText="No active streaks"
          />
        </div>

        <div className="card-enter">
          <RankedCard
            title="Loss Streak"
            icon={<FrostIcon size={14} />}
            accentColor="#60a5fa"
            dimColor="#1e3a5f"
            rows={lossStreakRows}
            firePlayerIds={firePlayerIds}
            emptyText="No active streaks"
          />
        </div>

        <div className="card-enter">
          <RankedCard
            title="Most Reliable"
            icon="📅"
            accentColor="#22d3ee"
            dimColor="#0e2533"
            rows={reliableRows}
            firePlayerIds={firePlayerIds}
            emptyText="No games this season"
          />
        </div>

      </div>
    </div>
  )
}

// ─── Countdown card ────────────────────────────────────────────
function CountdownCard({ isMatchday, isOnBreak, daysUntil, nextSundayStr, scheduledSession }) {
  // Derive substate — only show MATCHDAY if a session actually exists without a result
  const showMatchday = isMatchday && !!scheduledSession && !scheduledSession.result
  const showFulltime = isMatchday && !!scheduledSession?.result
  const showNoGame   = isMatchday && !scheduledSession

  let borderColor = '#252d3a'
  let bg = 'linear-gradient(135deg, #0f1a12, #141920)'
  let shadow = 'none'
  let extraClass = ''
  if (showMatchday) { borderColor = '#16a34a'; bg = 'linear-gradient(135deg, #0d2a13, #0a1f0e)'; shadow = '0 0 30px #16a34a22'; extraClass = 'matchday-glow' }
  if (showFulltime) { borderColor = '#3b82f655'; bg = 'linear-gradient(135deg, #0d1520, #141920)'; shadow = '0 0 20px #3b82f611' }

  return (
    <div
      className={`rounded-2xl overflow-hidden relative card-hover ${extraClass}`}
      style={{ background: bg, border: `1px solid ${borderColor}`, boxShadow: shadow }}
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
          {isMatchday ? '🟢 Today' : isOnBreak ? '🌙 Ramadan Break — Returns' : 'Next Matchday'}
        </p>

        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-base font-bold text-[#f1f5f9] uppercase leading-tight"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              {fmtDay(nextSundayStr)}
            </p>
            {showNoGame && (
              <Link to="/lineups" className="text-xs text-[#334155] hover:text-[#16a34a] transition-colors mt-1 block">
                No game scheduled →
              </Link>
            )}
            {showMatchday && (
              <p className="text-xs text-[#64748b] mt-1">
                {scheduledSession.playerIds.length} players confirmed
              </p>
            )}
            {showFulltime && (
              <p className="text-xs text-[#64748b] mt-1">
                {scheduledSession.playerIds.length} players
              </p>
            )}
            {!isMatchday && !scheduledSession && (
              <Link to="/lineups" className="text-xs text-[#334155] hover:text-[#16a34a] transition-colors mt-1 block">
                No game scheduled →
              </Link>
            )}
            {!isMatchday && scheduledSession && (
              <p className="text-xs text-[#64748b] mt-1">
                {scheduledSession.playerIds.length} players confirmed
              </p>
            )}
          </div>

          {showMatchday && (
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
          )}

          {showFulltime && (
            <div className="text-right">
              <p
                className="text-2xl font-bold uppercase leading-none"
                style={{ fontFamily: "'Oswald', sans-serif", color: '#60a5fa' }}
              >
                Full Time
              </p>
            </div>
          )}

          {(showNoGame || !isMatchday) && (
            <div className="text-right">
              <p
                className="countdown-num"
                style={{
                  fontSize: daysUntil <= 2 ? 64 : 56,
                  color: daysUntil <= 2 ? '#22c55e' : '#f1f5f9',
                  textShadow: daysUntil <= 2 ? '0 0 30px #16a34a44, 0 0 60px #16a34a22' : 'none',
                }}
              >
                {daysUntil}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[#64748b]">
                {daysUntil === 0 ? 'no game today' : daysUntil === 1 ? 'day to go' : 'days to go'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Weather helpers ────────────────────────────────────────────
function weatherEmoji(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

// ─── Last result card ──────────────────────────────────────────
function LastResultCard({ session, players, playerName, firePlayerIds = new Set() }) {
  const { scoreA, scoreB } = session.result
  const aWon = scoreA > scoreB
  const bWon = scoreB > scoreA
  const isDraw = scoreA === scoreB
  const motmIds = session.motm ?? []
  const motmPlayers = motmIds.map((id) => players.find((p) => p.id === id)).filter(Boolean)

  const teamA = session.teams?.teamA ?? []
  const teamB = session.teams?.teamB ?? []

  return (
    <div className="rounded-2xl overflow-hidden card-hover" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      {/* card header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]"
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            Last Result
          </p>
          <p className="text-xs text-[#334155] mt-0.5">{fmtShort(session.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {session.weather && (
            <span className="text-xs text-[#475569]">
              {weatherEmoji(session.weather.code)} {session.weather.tempC}°C
            </span>
          )}
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
      </div>

      {/* scoreline */}
      <div className="flex items-center px-4 py-5 gap-2">
        {/* Team A */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#16a34a' }}>Team A</p>
          {teamA.slice(0, 5).map((id) => {
            const p = players.find((pl) => pl.id === id)
            const isMotm = motmIds.includes(id)
            return (
              <div key={id} className="flex items-center gap-1 leading-relaxed" style={{ color: isMotm ? '#fbbf24' : '#94a3b8' }}>
                <PlayerAvatar player={p} size={14} />
                {isMotm && <span className="text-[10px] shrink-0">⭐</span>}
                <span className="text-xs truncate">{playerName(id)}</span>
                {firePlayerIds.has(id) && <FireIcon size={11} />}
                {session.result.goals?.[id] > 0 && (
                  <span className="text-[#22c55e] text-[10px] shrink-0">⚽{session.result.goals[id]}</span>
                )}
              </div>
            )
          })}
          {teamA.length > 5 && <p className="text-[10px] text-[#334155]">+{teamA.length - 5} more</p>}
        </div>

        {/* Score */}
        <div className="flex flex-col items-center shrink-0 px-2">
          {session.result.scoreKnown === false ? (
            <span
              className="text-xl font-bold px-3 py-1.5 rounded-xl"
              style={{
                fontFamily: "'Oswald', sans-serif",
                background: aWon ? '#14532d' : bWon ? '#1e3a5f' : '#3d2c00',
                color: aWon ? '#22c55e' : bWon ? '#60a5fa' : '#f59e0b',
              }}
            >
              {aWon ? 'W-L' : bWon ? 'L-W' : 'D-D'}
            </span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span
                className="score-num"
                style={{
                  fontSize: 60,
                  color: aWon ? '#22c55e' : isDraw ? '#94a3b8' : '#334155',
                  textShadow: aWon ? '0 0 24px #16a34a44, 0 0 48px #16a34a22' : 'none',
                }}
              >
                {scoreA}
              </span>
              <span className="score-num text-2xl text-[#252d3a]">–</span>
              <span
                className="score-num"
                style={{
                  fontSize: 60,
                  color: bWon ? '#60a5fa' : isDraw ? '#94a3b8' : '#334155',
                  textShadow: bWon ? '0 0 24px #3b82f644, 0 0 48px #3b82f622' : 'none',
                }}
              >
                {scoreB}
              </span>
            </div>
          )}
          <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">
            {session.playerIds.length} players
          </p>
        </div>

        {/* Team B */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#3b82f6' }}>Team B</p>
          {teamB.slice(0, 5).map((id) => {
            const p = players.find((pl) => pl.id === id)
            const isMotm = motmIds.includes(id)
            return (
              <div key={id} className="flex items-center justify-end gap-1 leading-relaxed" style={{ color: isMotm ? '#fbbf24' : '#94a3b8' }}>
                {session.result.goals?.[id] > 0 && (
                  <span className="text-[#60a5fa] text-[10px] shrink-0">⚽{session.result.goals[id]}</span>
                )}
                {firePlayerIds.has(id) && <FireIcon size={11} />}
                <span className="text-xs truncate">{playerName(id)}</span>
                {isMotm && <span className="text-[10px] shrink-0">⭐</span>}
                <PlayerAvatar player={p} size={14} />
              </div>
            )
          })}
          {teamB.length > 5 && <p className="text-[10px] text-[#334155]">+{teamB.length - 5} more</p>}
        </div>
      </div>

      {/* MOTM footer */}
      {motmPlayers.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid #252d3a', background: 'linear-gradient(to right, #2d1f00, #141920)' }}
        >
          <span className="text-sm shrink-0">⭐</span>
          <div className="flex -space-x-1 shrink-0">
            {motmPlayers.map((p) => <PlayerAvatar key={p.id} player={p} size={22} />)}
          </div>
          <p className="text-xs text-[#a16207]">
            {motmPlayers.length > 1 ? 'Joint ' : ''}Man of the Match —{' '}
            <span className="font-bold text-[#fbbf24]" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {motmPlayers.map((p) => p.name).join(' & ')}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Ranked board (top 5) ──────────────────────────────────────
function RankedCard({ title, icon, accentColor, dimColor, rows = [], emptyText, firePlayerIds = new Set() }) {
  const hasRows = rows.length > 0
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 card-hover"
      style={{
        background: hasRows ? `linear-gradient(135deg, ${dimColor}, #141920)` : '#141920',
        border: `1px solid ${hasRows ? accentColor + '44' : '#252d3a'}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm leading-none">{icon}</span>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Oswald', sans-serif", color: hasRows ? accentColor : '#334155' }}
        >
          {title}
        </p>
      </div>
      {hasRows ? (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const top = row.rank === 1
            return (
              <Link
                key={row.player.id}
                to={`/player/${row.player.id}`}
                className="flex items-center gap-2.5 min-w-0"
              >
                <span
                  className="w-4 text-center shrink-0 font-bold"
                  style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: top ? accentColor : '#475569' }}
                >
                  {row.rank}
                </span>
                <PlayerAvatar player={row.player} size={top ? 26 : 22} />
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <p
                    className="font-bold uppercase leading-tight truncate"
                    style={{ fontFamily: "'Oswald', sans-serif", fontSize: top ? 16 : 14, color: top ? accentColor : '#cbd5e1' }}
                  >
                    {row.player.name}
                  </p>
                  {firePlayerIds.has(row.player.id) && <FireIcon size={top ? 13 : 11} />}
                </div>
                <span
                  className="shrink-0 font-bold tabular-nums"
                  style={{ fontFamily: "'Oswald', sans-serif", fontSize: top ? 15 : 13, color: top ? accentColor : accentColor + '99' }}
                >
                  {row.label}
                </span>
              </Link>
            )
          })}
        </div>
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
      className="rounded-xl p-3 text-center card-hover"
      style={{ background: '#141920', border: `1px solid ${color}22` }}
    >
      <p className="score-num" style={{ fontSize: 40, color }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[#64748b] mt-1">{label}</p>
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
          {action.label} →
        </Link>
      )}
    </div>
  )
}
