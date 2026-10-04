import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { BREAK, MIN_RATED_GAMES, MIN_STREAK_GAMES } from '../lib/constants'
import { currentYear, fmtDate, getNextMatchday, pct, plural, weatherEmoji } from '../lib/format'
import { formatOf, motmIdsOf, rankRows, winnerOf } from '../lib/stats'
import { EmptyState, Loading, Segmented, StatTile } from '../components/ui'
import { ChevronRightIcon } from '../components/icons'
import MatchFace from '../components/MatchFace'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'

const TOP_N = 5
const ADMIN_TAPS = 7 // taps on the title that open the admin PIN pad

// Everything on Home is current-season only — never all-time.
export default function Dashboard() {
  const { players, sessions, playedSessions, sessionsLoaded, getPlayerStats, getMotmCount, getStreaks, getAttendance } = useApp()
  const navigate = useNavigate()
  const tapCount = useRef(0)
  const tapTimer = useRef(null)
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  function handleTitleTap() {
    tapCount.current += 1
    clearTimeout(tapTimer.current)
    if (tapCount.current >= ADMIN_TAPS) {
      tapCount.current = 0
      navigate('/admin')
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 3000)
  }

  if (!sessionsLoaded) return <Loading />

  const year = currentYear()
  const next = getNextMatchday()
  const onNextDate = sessions.filter((s) => s.date === next.date)
  const scheduled = onNextDate.find((s) => !s.result) ?? onNextDate[0] ?? null
  const lastResult = sessions.find((s) => s.result) ?? null // sessions arrive newest-first

  // ── Season numbers ──
  const seasonGames = playedSessions.filter((s) => s.date?.startsWith(year) && s.result)
  const seasonPlayers = new Set(seasonGames.flatMap((s) => s.playerIds)).size
  const seasonGoals = seasonGames.reduce(
    (sum, s) => (s.result.scoreKnown === false ? sum : sum + s.result.scoreA + s.result.scoreB),
    0,
  )

  // ── Leader boards ──
  const season = players.map((p) => ({
    player: p,
    ...getPlayerStats(p.id, year),
    motm: getMotmCount(p.id, year),
    attendance: getAttendance(p.id, year),
    ...getStreaks(p.id),
  }))
  const top = (rows, valueOf, labelOf) =>
    rankRows(rows.slice(0, TOP_N), valueOf).map(({ item, rank }) => ({ player: item.player, rank, label: labelOf(item) }))

  const boards = {
    motm: {
      rows: top(season.filter((r) => r.motm > 0).sort((a, b) => b.motm - a.motm), (r) => r.motm, (r) => `${r.motm}`),
      unit: 'awards', color: '#fbbf24', empty: 'No awards yet this season',
    },
    win: {
      rows: top(
        season
          .filter((r) => r.played >= MIN_RATED_GAMES)
          .map((r) => ({ ...r, winPct: pct(r.wins, r.played) }))
          .sort((a, b) => b.winPct - a.winPct || b.played - a.played),
        (r) => r.winPct,
        (r) => `${r.winPct}%`,
      ),
      unit: `min ${MIN_RATED_GAMES} games`, color: '#22c55e', empty: `Needs ${MIN_RATED_GAMES}+ games this season`,
    },
    reliable: {
      rows: top(
        season
          .filter((r) => r.attendance.played >= MIN_STREAK_GAMES && r.attendance.rate !== null)
          .sort((a, b) => b.attendance.rate - a.attendance.rate || b.attendance.played - a.attendance.played),
        (r) => r.attendance.rate,
        (r) => `${r.attendance.rate}%`,
      ),
      unit: 'attendance', color: '#60a5fa', empty: 'No games this season yet',
    },
  }

  const streakers = season.filter((r) => r.played >= MIN_STREAK_GAMES)
  const hot = top(streakers.filter((r) => r.winStreak >= 2).sort((a, b) => b.winStreak - a.winStreak), (r) => r.winStreak, (r) => `${r.winStreak}`)
  const cold = top(streakers.filter((r) => r.lossStreak >= 2).sort((a, b) => b.lossStreak - a.lossStreak), (r) => r.lossStreak, (r) => `${r.lossStreak}`)

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <header
        className="grain hero-enter relative overflow-hidden px-5 pb-7"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 34px)' }}
      >
        {/* season year as oversized scoreboard numerals */}
        <span
          aria-hidden="true"
          className="num pointer-events-none absolute -right-3 top-6 select-none text-[190px] text-transparent"
          style={{ WebkitTextStroke: '1.5px rgba(34,197,94,0.16)' }}
        >
          {year.slice(2)}
        </span>
        <div className="relative z-10">
          <p className="kicker mb-3">Sunday 7-a-side</p>
          <h1 onClick={handleTitleTap} className="display cursor-default select-none text-[64px] text-ink">
            Sunday
            <br />
            <span className="text-green-bright" style={{ textShadow: '0 0 34px rgba(22,163,74,0.55)' }}>FC</span>
          </h1>
          <p className="mt-3 text-sm text-mist">{year} season</p>
        </div>
      </header>

      <div className="stagger space-y-4 px-4">
        <NextMatchCard next={next} session={scheduled} />

        {lastResult ? (
          <LastResultCard session={lastResult} />
        ) : (
          <EmptyState
            title="No results yet"
            body="Record your first match to see it here."
            action={<Link to="/lineups" className="btn btn-primary">Add a game</Link>}
          />
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile value={seasonGames.length} label="Matches" color="#22c55e" />
          <StatTile value={seasonPlayers} label="Players" />
          <StatTile value={seasonGoals} label="Goals" color="#fbbf24" />
        </div>

        <LeadersCard boards={boards} />

        {(hot.length > 0 || cold.length > 0) && (
          <div className="grid grid-cols-2 gap-2.5">
            <StreakCard title="Hot streak" icon={<FireIcon size={14} />} rows={hot} color="#f59e0b" unit="W" empty="Nobody's on a run" />
            <StreakCard title="Cold spell" icon={<FrostIcon size={14} />} rows={cold} color="#60a5fa" unit="L" empty="Nobody's slumping" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Next match ────────────────────────────────────────────────
function NextMatchCard({ next, session }) {
  const { date, daysUntil, isOnBreak } = next
  const isToday = daysUntil === 0
  const live = isToday && session && !session.result
  const fullTime = isToday && !!session?.result

  let label = 'Next matchday'
  if (isOnBreak) label = `${BREAK.label} · back on`
  else if (live) label = 'Matchday'
  else if (fullTime) label = 'Full time'
  else if (isToday) label = 'Today'

  return (
    <section
      className={`card relative overflow-hidden ${live ? 'matchday-glow' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #0d2114 0%, #141920 62%)',
        borderColor: live ? '#16a34a' : undefined,
      }}
    >
      {/* corner flag stripes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-36 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, #22c55e 0 2px, transparent 2px 14px)' }}
      />
      <div className="relative flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="eyebrow mb-2 flex items-center gap-2" style={{ color: live ? '#22c55e' : undefined }}>
            {live && <span className="live-dot h-2 w-2 rounded-full bg-green-bright" />}
            {label}
          </p>
          <p className="display text-[22px] leading-tight text-ink">{fmtDate(date, 'day')}</p>
          <p className="mt-1.5 text-sm text-mist">
            {session
              ? `${plural(session.playerIds.length, 'player')} · ${formatOf(session)}-a-side`
              : isOnBreak ? 'Enjoy the rest.' : 'No teams picked yet'}
          </p>
        </div>

        {!live && !fullTime && (
          <div className="shrink-0 text-right">
            <p
              className="num text-[72px]"
              style={{
                color: daysUntil <= 2 ? '#22c55e' : '#f1f5f9',
                textShadow: daysUntil <= 2 ? '0 0 34px rgba(22,163,74,0.5)' : 'none',
              }}
            >
              {daysUntil}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {daysUntil === 1 ? 'day to go' : 'days to go'}
            </p>
          </div>
        )}
        {fullTime && <span className="display shrink-0 text-3xl text-blue-bright">FT</span>}
      </div>

      {!isOnBreak && !fullTime && (
        <div className="relative border-t border-line/70 px-5 py-3">
          {session ? (
            <Link to="/lineups" className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-green-bright">
              {live ? 'Enter the score' : 'View the lineup'}
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          ) : (
            <Link to="/balance" className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-green-bright">
              Pick the teams
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Last result ───────────────────────────────────────────────
function LastResultCard({ session }) {
  const { playerById } = useApp()
  const winner = winnerOf(session)
  const motmPlayers = motmIdsOf(session).map((id) => playerById.get(id)).filter(Boolean)
  const verdict = { A: ['Team A win', 'chip-green'], B: ['Team B win', 'chip-blue'], D: ['Draw', 'chip-amber'] }[winner]

  return (
    <section className="card overflow-hidden">
      <div className="card-head justify-between">
        <div>
          <h2 className="eyebrow text-mist">Last result</h2>
          <p className="mt-0.5 text-xs text-muted">
            {fmtDate(session.date)}
            {session.weather && <> · {weatherEmoji(session.weather.code)} {session.weather.tempC}°C</>}
          </p>
        </div>
        <span className={`chip ${verdict[1]}`}>{verdict[0]}</span>
      </div>

      <div className="px-4 py-5">
        <MatchFace session={session} max={7} scoreSize={46} />
      </div>

      {motmPlayers.length > 0 && (
        <div
          className="flex items-center gap-3 border-t border-gold-mid/50 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, #2d1f00, #141920)' }}
        >
          <div className="flex shrink-0 -space-x-1.5">
            {motmPlayers.map((p) => <PlayerAvatar key={p.id} player={p} size={30} ring="#fbbf24" />)}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-mid">
              {motmPlayers.length > 1 ? 'Joint ' : ''}Man of the Match
            </p>
            <p className="display motm-shimmer truncate text-lg leading-tight text-gold">
              {motmPlayers.map((p) => p.name).join(' & ')}
            </p>
          </div>
          <span className="ml-auto text-xl" aria-hidden="true">⭐</span>
        </div>
      )}
    </section>
  )
}

// ─── Season leaders (tabbed) ───────────────────────────────────
const BOARD_TABS = [
  { value: 'motm', label: 'MOTM' },
  { value: 'win', label: 'Win rate' },
  { value: 'reliable', label: 'Reliable' },
]

function LeadersCard({ boards }) {
  const { firePlayerIds } = useApp()
  const [tab, setTab] = useState('motm')
  const board = boards[tab]

  return (
    <section className="card overflow-hidden">
      <div className="card-head justify-between">
        <h2 className="eyebrow text-mist">Season leaders</h2>
        <span className="text-[11px] text-muted">{board.unit}</span>
      </div>
      <div className="px-3 pt-3">
        <Segmented options={BOARD_TABS} value={tab} onChange={setTab} />
      </div>
      {board.rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{board.empty}</p>
      ) : (
        <ol className="p-2">
          {board.rows.map((row) => {
            const lead = row.rank === 1
            return (
              <li key={row.player.id}>
                <Link
                  to={`/player/${row.player.id}`}
                  className="press flex items-center gap-3 rounded-2xl px-2 py-2"
                  style={lead ? { background: `linear-gradient(90deg, ${board.color}1f, transparent)` } : undefined}
                >
                  <span className="num w-5 shrink-0 pt-1 text-center text-xl" style={{ color: lead ? board.color : '#475569' }}>
                    {row.rank}
                  </span>
                  <PlayerAvatar player={row.player} size={lead ? 40 : 30} ring={lead ? board.color : null} />
                  <span className={`display min-w-0 flex-1 truncate ${lead ? 'text-xl text-ink' : 'text-base text-soft'}`}>
                    {row.player.name}
                    {firePlayerIds.has(row.player.id) && <span className="ml-1.5 align-middle"><FireIcon size={13} /></span>}
                  </span>
                  <span className="num shrink-0 pt-1" style={{ fontSize: lead ? 34 : 24, color: lead ? board.color : '#94a3b8' }}>
                    {row.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ─── Streak column ─────────────────────────────────────────────
function StreakCard({ title, icon, rows, color, unit, empty }) {
  return (
    <section className="card p-3.5">
      <h2 className="eyebrow mb-3 flex items-center gap-1.5" style={{ color }}>{icon}{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.player.id}>
              <Link to={`/player/${row.player.id}`} className="flex items-center gap-2">
                <PlayerAvatar player={row.player} size={22} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-soft">{row.player.name}</span>
                <span className="num pt-0.5 text-lg" style={{ color }}>{row.label}{unit}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
