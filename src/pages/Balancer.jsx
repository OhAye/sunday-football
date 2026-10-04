import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { useFeedback } from '../components/feedback-context'
import { MIN_BALANCE_PLAYERS, MIN_RATED_GAMES, REGULAR_THRESHOLD, TEAM } from '../lib/constants'
import { fmtDate, pct, upcomingSunday } from '../lib/format'
import { balanceTeams, teamAverage } from '../lib/balance'
import { Loading, PageHeader } from '../components/ui'
import { CheckIcon, ShuffleIcon, SwapIcon } from '../components/icons'
import PlayerAvatar from '../components/PlayerAvatar'

const UNRATED = 50 // rating for players without enough games to trust their win rate

// Teams tab: tick who's playing, get two balanced sides, then save them as a match.
export default function Balancer() {
  const { players, playerById, sessions, sessionsLoaded, getPlayerStats, saveMatch, updateSession } = useApp()
  const { toast } = useFeedback()
  const navigate = useNavigate()

  const [date, setDate] = useState(upcomingSunday)
  const [selected, setSelected] = useState([])
  const [teams, setTeams] = useState(null) // { teamA, teamB } | null
  const [showOthers, setShowOthers] = useState(false)
  const [saving, setSaving] = useState(false)

  // Rating = all-time win rate, once a player has enough games for it to mean something
  const { ratings, rated, games } = useMemo(() => {
    const ratings = {}, rated = {}, games = {}
    for (const p of players) {
      const s = getPlayerStats(p.id)
      games[p.id] = s.played
      rated[p.id] = s.played >= MIN_RATED_GAMES
      ratings[p.id] = rated[p.id] ? pct(s.wins, s.played) : UNRATED
    }
    return { ratings, rated, games }
  }, [players, getPlayerStats])

  if (!sessionsLoaded) return <Loading />

  const available = players.filter((p) => !p.injured).sort((a, b) => a.name.localeCompare(b.name))
  const injuredCount = players.length - available.length
  const regulars = available.filter((p) => games[p.id] >= REGULAR_THRESHOLD)
  const others = available.filter((p) => games[p.id] < REGULAR_THRESHOLD)
  const selectedSet = new Set(selected)
  const othersSelected = others.filter((p) => selectedSet.has(p.id)).length

  const lastMatch = sessions.find((s) => s.result && s.playerIds.length > 0)
  const existing = sessions.find((s) => s.date === date && !s.result) // an unplayed match already on this date
  const enough = selected.length >= MIN_BALANCE_PLAYERS

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setTeams(null)
  }
  function selectLastSquad() {
    const ok = new Set(available.map((p) => p.id))
    setSelected(lastMatch.playerIds.filter((id) => ok.has(id)))
    setTeams(null)
  }
  function swap(id) {
    setTeams(({ teamA, teamB }) =>
      teamA.includes(id)
        ? { teamA: teamA.filter((x) => x !== id), teamB: [...teamB, id] }
        : { teamA: [...teamA, id], teamB: teamB.filter((x) => x !== id) })
  }

  async function handleSave() {
    if (!teams || saving) return
    setSaving(true)
    const ok = existing
      ? await updateSession(existing.id, {
          playerIds: [...new Set([...teams.teamA, ...teams.teamB])],
          teams: { teamA: teams.teamA, teamB: teams.teamB, format: Math.max(teams.teamA.length, teams.teamB.length) > 7 ? 9 : 7 },
        })
      : !!(await saveMatch({ date, teamA: teams.teamA, teamB: teams.teamB, scoreA: '', scoreB: '' }))
    setSaving(false)
    if (!ok) return toast('Couldn’t save the teams. Check your connection and try again.', 'error')
    toast(existing ? 'Lineup updated' : 'Match created')
    navigate('/lineups')
  }

  return (
    <div className="flex flex-col">
      <PageHeader kicker="Team picker" title="Teams" sub="Tick who’s in and get two even sides." />

      <div className="stagger space-y-4 px-4">
        {/* ── Step 1: who's playing ── */}
        <section className="card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="eyebrow text-mist">Who’s playing?</h2>
              {injuredCount > 0 && <p className="mt-0.5 text-[11px] text-muted">{injuredCount} injured not shown</p>}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="num pt-1 text-4xl" style={{ color: enough ? '#22c55e' : '#f1f5f9' }}>{selected.length}</span>
              <span className="text-xs text-muted">in</span>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            {lastMatch && (
              <button type="button" className="btn btn-sm btn-quiet" onClick={selectLastSquad}>Last match’s squad</button>
            )}
            {selected.length > 0 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSelected([]); setTeams(null) }}>Clear</button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {regulars.map((p) => <PlayerToggle key={p.id} player={p} on={selectedSet.has(p.id)} onToggle={toggle} />)}
          </div>

          {others.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <button type="button" onClick={() => setShowOthers((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted">
                <span>Occasional players · {others.length}{othersSelected > 0 && <span className="text-green-bright"> · {othersSelected} in</span>}</span>
                <span>{showOthers ? 'Hide' : 'Show'}</span>
              </button>
              {showOthers && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {others.map((p) => <PlayerToggle key={p.id} player={p} on={selectedSet.has(p.id)} onToggle={toggle} />)}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Step 2: suggest ── */}
        {!teams && (
          <div>
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!enough}
              onClick={() => setTeams(balanceTeams(selected, ratings))}>
              Suggest teams
            </button>
            {!enough && (
              <p className="mt-2 text-center text-xs text-muted">
                {selected.length === 0
                  ? `Pick at least ${MIN_BALANCE_PLAYERS} players.`
                  : `${MIN_BALANCE_PLAYERS - selected.length} more to go (minimum ${MIN_BALANCE_PLAYERS}).`}
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: review + save ── */}
        {teams && (
          <>
            <BalanceMeter avgA={teamAverage(teams.teamA, ratings)} avgB={teamAverage(teams.teamB, ratings)} />

            <div className="grid grid-cols-2 gap-2.5">
              {['A', 'B'].map((side) => (
                <TeamCard
                  key={side} side={side}
                  ids={side === 'A' ? teams.teamA : teams.teamB}
                  ratings={ratings} rated={rated} playerById={playerById} onSwap={swap}
                />
              ))}
            </div>
            <p className="-mt-1 text-center text-xs text-muted">Tap a player to move them to the other side.</p>

            {teams.teamA.length !== teams.teamB.length && (
              <p className="text-center text-xs font-semibold text-amber">
                Uneven sides: {teams.teamA.length} v {teams.teamB.length}
              </p>
            )}

            <button type="button" className="btn btn-quiet btn-block" onClick={() => setTeams(balanceTeams(selected, ratings, { jitter: 7 }))}>
              <ShuffleIcon className="w-4 h-4" /> Shuffle
            </button>

            <section className="card space-y-4 p-4">
              <div>
                <label className="field-label" htmlFor="balance-date">Match date</label>
                <input id="balance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
                {existing && (
                  <p className="mt-2 text-xs text-amber">
                    There’s already an unplayed match on {fmtDate(date, 'tiny')} — saving will replace its lineup.
                  </p>
                )}
              </div>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleSave} disabled={saving || !date}>
                {saving ? 'Saving…' : existing ? 'Update that lineup' : 'Create match'}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function PlayerToggle({ player, on, onToggle }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={() => onToggle(player.id)}
      className={`flex min-h-10 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm font-medium transition-colors active:scale-95 ${
        on ? 'border-green bg-green text-white' : 'border-line bg-raised text-mist'
      }`}
    >
      {on ? (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/20">
          <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      ) : (
        <PlayerAvatar player={player} size={26} />
      )}
      {player.name}
    </button>
  )
}

// How evenly matched the two sides are, by average rating
function BalanceMeter({ avgA, avgB }) {
  const gap = Math.abs(avgA - avgB)
  const verdict = gap <= 2 ? 'Dead even' : gap <= 5 ? 'Well matched' : gap <= 9 ? 'Slight edge' : 'Lopsided'
  const share = avgA + avgB > 0 ? (avgA / (avgA + avgB)) * 100 : 50
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="eyebrow" style={{ color: TEAM.A.text }}>Team A</p>
          <p className="num mt-2 text-4xl" style={{ color: TEAM.A.text }}>{avgA}</p>
        </div>
        <div className="pb-1 text-center">
          <p className="display text-sm text-ink">{verdict}</p>
          <p className="text-[11px] text-muted">avg win rate</p>
        </div>
        <div className="text-right">
          <p className="eyebrow" style={{ color: TEAM.B.text }}>Team B</p>
          <p className="num mt-2 text-4xl" style={{ color: TEAM.B.text }}>{avgB}</p>
        </div>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <div className="rounded-full transition-all duration-500" style={{ width: `${share}%`, background: TEAM.A.color }} />
        <div className="flex-1 rounded-full" style={{ background: TEAM.B.color }} />
      </div>
    </section>
  )
}

function TeamCard({ side, ids, ratings, rated, playerById, onSwap }) {
  const team = TEAM[side]
  return (
    <section className="card p-2.5" style={{ background: team.deep, borderColor: `${team.color}55` }}>
      <div className="mb-2 flex items-center justify-between px-1.5">
        <h2 className="eyebrow" style={{ color: team.text }}>{team.label}</h2>
        <span className="text-xs font-semibold" style={{ color: team.text }}>{ids.length}</span>
      </div>
      <ul className="space-y-1">
        {ids.map((id) => {
          const p = playerById.get(id)
          return (
            <li key={id}>
              <button type="button" onClick={() => onSwap(id)} aria-label={`Move ${p?.name} to the other team`}
                className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left active:bg-white/5">
                <PlayerAvatar player={p} size={24} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p?.name}</span>
                <span className="text-[11px] tabular-nums text-muted">{rated[id] ? `${ratings[id]}%` : 'new'}</span>
                <SwapIcon className="w-3 h-3 shrink-0 rotate-90 text-faint" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
