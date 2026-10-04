import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { MIN_STREAK_GAMES, POSITION_META, RESULT_COLOR, STREAK_BADGE, positionOf, winColor } from '../lib/constants'
import { currentYear, fmtDate, pct, plural } from '../lib/format'
import { computeH2H, outcomeFor } from '../lib/stats'
import { EmptyState, FormDots, Loading, PageHeader, Pills, RecordBar, Section } from '../components/ui'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'

const H2H_COLS = 'minmax(0,1fr) 76px 76px'
const RIVAL_MIN = 3 // head-to-head wins needed before someone counts as a nemesis / favourite opponent

export default function PlayerProfile() {
  // Rendered with key={id} by the router, so state resets when moving between players
  const { players, playerById, playedSessions, sessionsLoaded, getPlayerStats, getMotmCount, getStreaks, getAttendance } = useApp()
  const { id } = useParams()
  const thisYear = currentYear()
  const [period, setPeriod] = useState(thisYear) // 'all' | year
  const year = period === 'all' ? null : period

  const player = playerById.get(id)

  const periodSessions = useMemo(
    () => (year ? playedSessions.filter((s) => s.date?.startsWith(year)) : playedSessions),
    [playedSessions, year],
  )

  const lastMatch = useMemo(() => {
    const s = periodSessions.find((x) => outcomeFor(x, id)) // newest first
    if (!s) return null
    const inA = s.teams.teamA.includes(id)
    const { scoreA, scoreB, scoreKnown } = s.result
    return {
      date: s.date,
      outcome: outcomeFor(s, id),
      score: scoreKnown === false ? null : inA ? `${scoreA} – ${scoreB}` : `${scoreB} – ${scoreA}`,
    }
  }, [periodSessions, id])

  const h2hList = useMemo(
    () => players
      .filter((p) => p.id !== id)
      .map((other) => ({ other, h2h: computeH2H(id, other.id, periodSessions) }))
      .filter((x) => x.h2h.total > 0)
      .sort((a, b) => b.h2h.total - a.h2h.total),
    [players, id, periodSessions],
  )

  // Nemesis: beaten you most (3+). Favourite opponent: you've beaten most (3+, and more than they've beaten you).
  const rivals = useMemo(() => {
    const topBy = (list, valueOf) => {
      if (!list.length) return []
      const max = Math.max(...list.map(valueOf))
      return list.filter((x) => valueOf(x) === max).map((x) => ({ player: x.other, wins: max }))
    }
    return {
      nemesis: topBy(h2hList.filter((x) => x.h2h.opp.lossesA >= RIVAL_MIN), (x) => x.h2h.opp.lossesA),
      prey: topBy(h2hList.filter((x) => x.h2h.opp.winsA >= RIVAL_MIN && x.h2h.opp.winsA > x.h2h.opp.lossesA), (x) => x.h2h.opp.winsA),
    }
  }, [h2hList])

  if (!sessionsLoaded) return <Loading />
  if (!player) {
    return (
      <div className="px-4 pt-24">
        <EmptyState icon="🤷" title="Player not found" body="They may have been removed from the squad."
          action={<Link to="/players" className="btn btn-primary">Back to the squad</Link>} />
      </div>
    )
  }

  const stats = getPlayerStats(id, year)
  const winPct = pct(stats.wins, stats.played)
  const motm = getMotmCount(id, year)
  const streaks = getStreaks(id) // always current season
  const seasonGames = getPlayerStats(id, thisYear).played
  const attendance = getAttendance(id, year)
  const pos = positionOf(player)
  const meta = POSITION_META[pos]
  const showStreaks = seasonGames >= MIN_STREAK_GAMES && (streaks.winStreak > 0 || streaks.lossStreak > 0)

  const periods = [
    { value: thisYear, label: `${thisYear} season` },
    { value: String(Number(thisYear) - 1), label: `${Number(thisYear) - 1} season` },
    { value: 'all', label: 'All time' },
  ]

  return (
    <div className="flex flex-col">
      <PageHeader back kicker={meta.full} title={player.name} tint={`${meta.bg}aa`}>
        {/* shirt number as oversized scoreboard numerals */}
        {player.number && (
          <span aria-hidden="true" className="num pointer-events-none absolute -right-1 -top-2 select-none text-[150px] text-transparent"
            style={{ WebkitTextStroke: `1.5px ${meta.color}44` }}>
            {player.number}
          </span>
        )}
        <div className="mt-5 flex items-center gap-4">
          <PlayerAvatar player={player} size={84} ring={meta.color} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip" style={{ background: meta.bg, color: meta.color, borderColor: `${meta.color}55` }}>{pos}</span>
            {player.number && <span className="chip chip-neutral">#{player.number}</span>}
            {player.injured && <span className="chip chip-red">Injured</span>}
            {seasonGames >= MIN_STREAK_GAMES && streaks.winStreak >= STREAK_BADGE && <span className="chip chip-amber"><FireIcon size={11} /> On fire</span>}
            {seasonGames >= MIN_STREAK_GAMES && streaks.lossStreak >= STREAK_BADGE && <span className="chip chip-blue"><FrostIcon size={11} /> Cold spell</span>}
          </div>
        </div>
      </PageHeader>

      <div className="space-y-4 px-4">
        <Pills options={periods} value={period} onChange={setPeriod} />

        <div className="stagger space-y-4">
          {/* ── Record ── */}
          <section className="card overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-line">
              {[['Played', stats.played, '#f1f5f9'], ['Won', stats.wins, RESULT_COLOR.W], ['Drawn', stats.draws, '#94a3b8'], ['Lost', stats.losses, '#f87171']].map(([label, value, color]) => (
                <div key={label} className="px-1 pb-3 pt-4 text-center">
                  <p className="num text-[38px]" style={{ color }}>{value}</p>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
                </div>
              ))}
            </div>
            {stats.played > 0 && (
              <div className="border-t border-line px-4 py-3">
                <RecordBar wins={stats.wins} draws={stats.draws} losses={stats.losses} />
              </div>
            )}
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
              <Metric label="Win rate" value={winPct === null ? '–' : `${winPct}%`} color={winPct === null ? '#475569' : winColor(winPct)} />
              <Metric label="MOTM" value={motm || '–'} color={motm ? '#fbbf24' : '#475569'} shimmer={motm > 0} />
              <Metric label="Attendance" value={attendance.rate === null ? '–' : `${attendance.rate}%`} color={attendance.rate === null ? '#475569' : '#60a5fa'} />
            </div>
          </section>

          {/* ── Form ── */}
          {(attendance.last10.length > 0 || lastMatch) && (
            <Section title="Form" subtitle={attendance.last10.length > 0 ? `Last ${plural(attendance.last10.length, 'game')} · newest on the right` : undefined}>
              <div className="space-y-4 p-4">
                {attendance.last10.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <FormDots items={attendance.last10} size={16} animate />
                    <div className="flex shrink-0 gap-2.5 text-[10px] font-semibold text-muted">
                      {[['W', RESULT_COLOR.W], ['D', RESULT_COLOR.D], ['L', RESULT_COLOR.L]].map(([k, c]) => (
                        <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>
                      ))}
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-dashed border-ghost" />out</span>
                    </div>
                  </div>
                )}
                {lastMatch && (
                  <div className="inset flex items-center gap-3 px-3 py-2.5">
                    <span className="font-display flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-pitch" style={{ background: RESULT_COLOR[lastMatch.outcome] }}>
                      {lastMatch.outcome}
                    </span>
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Last match</p>
                      <p className="display text-base text-ink">{lastMatch.score ?? { W: 'Won', D: 'Drew', L: 'Lost' }[lastMatch.outcome]}</p>
                    </div>
                    <span className="text-xs text-muted">{fmtDate(lastMatch.date, 'tiny')}</span>
                  </div>
                )}
                {showStreaks && (
                  <p className="flex items-center gap-2 text-sm text-soft">
                    {streaks.winStreak > 0
                      ? <><FireIcon size={14} /> Won the last <strong className="text-amber">{plural(streaks.winStreak, 'game')}</strong> this season</>
                      : <><FrostIcon size={14} /> Lost the last <strong className="text-blue-bright">{plural(streaks.lossStreak, 'game')}</strong> this season</>}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── Rivals ── */}
          {(rivals.nemesis.length > 0 || rivals.prey.length > 0) && (
            <div className="grid grid-cols-2 gap-2.5">
              <RivalCard title="Nemesis" icon="💀" tone="red" list={rivals.nemesis} caption={(w) => `beaten you ${w}×`} empty="Nobody has your number" />
              <RivalCard title="Favourite opponent" icon="👑" tone="green" list={rivals.prey} caption={(w) => `you’ve beaten them ${w}×`} empty="Still looking for one" />
            </div>
          )}

          {/* ── Head to head ── */}
          {h2hList.length > 0 ? (
            <Section title="Head to head" subtitle="Wins – draws – losses from this player’s side">
              <div className="grid border-b border-line px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted" style={{ gridTemplateColumns: H2H_COLS }}>
                <span>Player</span>
                <span className="text-center">With</span>
                <span className="text-center">Against</span>
              </div>
              {h2hList.map(({ other, h2h }) => (
                <Link key={other.id} to={`/player/${other.id}`}
                  className="grid items-center border-b border-line/60 px-4 py-2.5 last:border-b-0 active:bg-raised" style={{ gridTemplateColumns: H2H_COLS }}>
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerAvatar player={other} size={24} />
                    <span className="truncate text-sm font-medium text-ink">{other.name}</span>
                  </span>
                  <Wdl played={h2h.same.played} w={h2h.same.wins} d={h2h.same.draws} l={h2h.same.losses} />
                  <Wdl played={h2h.opp.played} w={h2h.opp.winsA} d={h2h.opp.draws} l={h2h.opp.lossesA} />
                </Link>
              ))}
            </Section>
          ) : (
            stats.played === 0 && <EmptyState icon="📭" title="Nothing here yet" body="No games recorded for this period." />
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color, shimmer = false }) {
  return (
    <div className="px-1 pb-3 pt-3.5 text-center">
      <p className={`num text-[30px] ${shimmer ? 'motm-shimmer' : ''}`} style={{ color }}>{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  )
}

function Wdl({ played, w, d, l }) {
  if (!played) return <span className="text-center text-xs text-faint">–</span>
  return (
    <span className="text-center text-sm tabular-nums">
      <span className="font-semibold text-green-bright">{w}</span>
      <span className="text-faint"> – {d} – </span>
      <span className="text-red-bright">{l}</span>
    </span>
  )
}

function RivalCard({ title, icon, tone, list, caption, empty }) {
  const styles = {
    red: { background: 'linear-gradient(160deg, #2d1515, #141920)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' },
    green: { background: 'linear-gradient(160deg, #0d2114, #141920)', borderColor: 'rgba(22,163,74,0.4)', color: '#22c55e' },
  }[tone]
  return (
    <section className="card p-3.5" style={{ background: styles.background, borderColor: styles.borderColor }}>
      <h2 className="eyebrow mb-3" style={{ color: styles.color }}>{icon} {title}</h2>
      {list.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map(({ player, wins }) => (
            <li key={player.id}>
              <Link to={`/player/${player.id}`} className="flex items-center gap-2.5">
                <PlayerAvatar player={player} size={32} ring={styles.color} />
                <span className="min-w-0">
                  <span className="display block truncate text-sm text-ink">{player.name}</span>
                  <span className="block text-[11px]" style={{ color: styles.color }}>{caption(wins)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
