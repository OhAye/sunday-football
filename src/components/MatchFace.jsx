// The "face" of a match: Team A list · scoreboard · Team B list.
// Shared by the Home last-result card and the Games match cards.
import { Link } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { TEAM } from '../lib/constants'
import { motmIdsOf, winnerOf } from '../lib/stats'
import PlayerAvatar from './PlayerAvatar'
import FireIcon from './FireIcon'

// Scoreboard digits. When only the winner is known (scoreKnown === false) it shows W / L / D.
export function Scoreboard({ result, size = 44 }) {
  const winner = winnerOf({ result })
  const known = result.scoreKnown !== false
  const cell = (side) => {
    const won = winner === side
    const value = known
      ? (side === 'A' ? result.scoreA : result.scoreB)
      : winner === 'D' ? 'D' : won ? 'W' : 'L'
    const color = winner === 'D' ? '#cbd5e1' : won ? TEAM[side].text : '#475569'
    return (
      <span
        className="scorebox"
        style={{
          fontSize: size,
          color,
          textShadow: won ? `0 0 22px ${TEAM[side].color}88` : 'none',
          borderColor: won ? `${TEAM[side].color}66` : undefined,
        }}
      >
        {value}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1.5" aria-label={known ? `${result.scoreA} to ${result.scoreB}` : 'Result'}>
      {cell('A')}
      <span className="flex flex-col gap-1.5" aria-hidden="true">
        <span className="h-1 w-1 rounded-full bg-ghost" />
        <span className="h-1 w-1 rounded-full bg-ghost" />
      </span>
      {cell('B')}
    </div>
  )
}

export function TeamColumn({ side, ids, motmIds = [], max = Infinity, linked = true }) {
  const { playerById, firePlayerIds } = useApp()
  const team = TEAM[side]
  const right = side === 'B'
  const shown = ids.slice(0, max)
  return (
    <div className={`min-w-0 flex-1 ${right ? 'text-right' : ''}`}>
      <p className="eyebrow mb-2" style={{ color: team.text }}>{team.label}</p>
      <ul className="space-y-1.5">
        {shown.map((id) => {
          const player = playerById.get(id)
          const isMotm = motmIds.includes(id)
          const Row = linked && player ? Link : 'div'
          return (
            <li key={id}>
              <Row
                {...(linked && player ? { to: `/player/${id}` } : {})}
                className={`flex min-w-0 items-center gap-1.5 ${right ? 'flex-row-reverse' : ''}`}
              >
                <PlayerAvatar player={player ?? { name: '?' }} size={18} ring={isMotm ? '#fbbf24' : null} />
                <span className={`truncate text-[13px] leading-tight ${isMotm ? 'font-semibold text-gold' : 'text-soft'}`}>
                  {player?.name ?? 'Unknown'}
                </span>
                {isMotm && <span className="shrink-0 text-[10px]" aria-label="Man of the Match">⭐</span>}
                {firePlayerIds.has(id) && <FireIcon size={11} />}
              </Row>
            </li>
          )
        })}
      </ul>
      {ids.length > shown.length && (
        <p className="mt-1.5 text-[11px] text-muted">+{ids.length - shown.length} more</p>
      )}
    </div>
  )
}

export default function MatchFace({ session, max = Infinity, scoreSize = 44, linked = true }) {
  const motmIds = motmIdsOf(session)
  const teamA = session.teams?.teamA ?? []
  const teamB = session.teams?.teamB ?? []
  return (
    <div className="flex items-start gap-3">
      <TeamColumn side="A" ids={teamA} motmIds={motmIds} max={max} linked={linked} />
      <div className="flex shrink-0 flex-col items-center pt-5">
        {session.result
          ? <Scoreboard result={session.result} size={scoreSize} />
          : <span className="display px-2 py-2 text-2xl text-ghost">VS</span>}
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {teamA.length} v {teamB.length}
        </p>
      </div>
      <TeamColumn side="B" ids={teamB} motmIds={motmIds} max={max} linked={linked} />
    </div>
  )
}
